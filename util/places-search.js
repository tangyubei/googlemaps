import {addDestinationMarker} from "./markers.js";
import {State} from "./state.js";

export async function showCentroid() {
    if (!State.markers.length) return;
    const midLat = State.markers.reduce((sum, m) => sum + m.position.lat, 0) / State.markers.length;
    const midLon = State.markers.reduce((sum, m) => sum + m.position.lng, 0) / State.markers.length;
    // const locationLiteral = {
    //     lat: Number(midLat),   // ensure these are Numbers
    //     lng: Number(midLon)
    // };
    // //new AdvancedMarkerElement({ map, position: { lat: midLat, lng: midLon } });
    // addNearestPlace('restaurant', {lat: 41.8, lng: 87.6})
    //     .then(place => console.log('Nearest restaurant:', place.name))
    //     .catch(err => console.error('PlacesService error:', err));
    const centralLoc = await addNearestPlace("cafe", midLat, midLon);
    // console.log('centralLoc', centralLoc);
    // // console.log('centralLoc', centralLoc.geometry.position);
    // console.log('markers',markers[0].position);
    // const promises = markers.map(m =>
    //     calcAndCacheRoute(m.position, centralLoc, google.maps.TravelMode.WALKING)
    // );
    // Wait for every route to finish caching
    // await Promise.all(promises);

    // Now draw them all
    // showAllCachedRoutes();
}

function addNearestPlace(type, lat, lng) {
    return new Promise((resolve, reject) => {
        const loc = new google.maps.LatLng(lat, lng);
        const service = new google.maps.places.PlacesService(State.map);
        service.nearbySearch({
            location: loc,
            rankBy: google.maps.places.RankBy.DISTANCE,
            type,
        }, (results, status) => {
            if (status !== google.maps.places.PlacesServiceStatus.OK || !results[0]) {
                return reject(status);
            }
            const r = results[0].geometry.location;
            addDestinationMarker(results[0]);
            resolve({lat: r.lat(), lng: r.lng()});
        });
    });
}

/**
 * Split an array into chunks of at most `size` items.
 */
function chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

/**
 * Compute the geographic center (average lat/lng) and the
 * maximum distance from center to any point (in meters).
 */
function computeCenterAndMaxRadius(locations) {
    const lats = locations.map(p => p.lat);
    const lngs = locations.map(p => p.lng);
    const center = {
        lat: lats.reduce((a,b)=>a+b,0)/lats.length,
        lng: lngs.reduce((a,b)=>a+b,0)/lngs.length
    };
    // approximate meters per degree lat/lng
    const mPerDegLat = 111000;
    const mPerDegLng = 111000 * Math.cos(center.lat * Math.PI/180);
    let maxDist = 0;
    for (const p of locations) {
        const dy = (p.lat - center.lat) * mPerDegLat;
        const dx = (p.lng - center.lng) * mPerDegLng;
        maxDist = Math.max(maxDist, Math.hypot(dx,dy));
    }
    return { center, maxRadius: maxDist };
}

/**
 * Fetches up to ~60 cafes + restaurants around a central point,
 * within the given radius (in meters).
 *
 * Returns an array of PlaceResult.
 */
async function fetchCafesAndRestaurants(center, radius) {
    await google.maps.importLibrary('places');
    const svc = new google.maps.places.PlacesService(State.map);
    // helper to wrap one nearbySearch
    function ns(type, rad) {
        return new Promise((res, rej) => {
            svc.nearbySearch({
                location: center,
                radius:   rad,
                type,
            }, (results, status) => {
                if (status === 'OK') res(results);
                else rej(status);
            });
        });
    }
    // first get cafes, then restaurants, concat & dedupe
    const [cafes, restaurants] = await Promise.allSettled([
        ns('cafe',       radius),
        ns('restaurant', radius),
    ]).then(arr => arr.map(r => r.status === 'fulfilled' ? r.value : []));
    const map = new Map();
    for (const p of [...cafes, ...restaurants]) {
        map.set(p.place_id, p);
    }
    return Array.from(map.values());
}

/**
 * Given up to 10 user locations (LatLngLiteral) and an array
 * of PlaceResult candidates, picks the best one by walking time.
 */
async function pickBestWalkingPOI(userLocs, poiPlaces) {
    // 1) sanity
    if (!userLocs.length || !poiPlaces.length) {
        throw new Error('Need at least one user and one POI');
    }

    // 2) build origins & dest coords
    const allOrigins   = userLocs;
    const allDestCoords= poiPlaces.map(p => p.geometry.location.toJSON());

    // 3) chunk origins into <=25
    const originChunks = chunkArray(allOrigins, 25);

    // 4) prepare timesMap: destIdx → [durations…]
    const timesMap = new Map();
    const service  = new google.maps.DistanceMatrixService();
    const PENALTY  = 3600 * 999; // effectively infinite for walking

    // 5) loop originChunks
    for (const originChunk of originChunks) {
        // compute how many dests per request so that originChunk.length × destChunk.length ≤ 25
        const maxDest = Math.max(1, Math.floor(25 / originChunk.length));
        const destChunks = chunkArray(allDestCoords, maxDest);

        for (let ci = 0; ci < destChunks.length; ci++) {
            const destChunk = destChunks[ci];

            // fetch the matrix
            const response = await new Promise((res, rej) => {
                service.getDistanceMatrix({
                    origins:      originChunk,
                    destinations: destChunk,
                    travelMode:   google.maps.TravelMode.TRANSIT,
                    unitSystem:   google.maps.UnitSystem.METRIC,
                }, (r, status) => {
                    if (status === 'OK') res(r);
                    else               rej(new Error(`DMS error: ${status}`));
                });
            });

            // accumulate times (with penalty for ZERO_RESULTS)
            for (let j = 0; j < destChunk.length; j++) {
                const globalIdx = ci * maxDest + j;
                response.rows.forEach(row => {
                    const el = row.elements[j];
                    const t  = (el?.status === 'OK' && el.duration)
                        ? el.duration.value
                        : PENALTY;
                    const arr = timesMap.get(globalIdx) || [];
                    arr.push(t);
                    timesMap.set(globalIdx, arr);
                });
            }
        }
    }

    // 6) Score every POI that has exactly one time per user
    const scored = [];
    const userCount = allOrigins.length;
    for (const [destIdx, times] of timesMap.entries()) {
        if (times.length === userCount) {
            const total   = times.reduce((a,b)=>a+b,0);
            const maxTime = Math.max(...times);
            // α trades off total vs worst-case
            const α       = 0.7;
            const score   = α * total + (1 - α) * maxTime;
            scored.push({ destIdx, score });
        }
    }
    if (!scored.length) {
        throw new Error('No reachable POIs by walking');
    }

    // 7) pick the best
    scored.sort((a,b)=>a.score - b.score);
    return poiPlaces[ scored[0].destIdx ];
}

/**
 * Top‑level: given up to 10 user LatLngLiterals, find the best walkable café/restaurant.
 */
export async function findBestWalkingCafeOrRestaurant(userLocs) {
    const { center, maxRadius } = computeCenterAndMaxRadius(userLocs);
    // add a bit of buffer so you include POIs slightly outside
    const searchRadius = Math.max(1000, maxRadius + 500);

    // fetch real POIs
    const pois = await fetchCafesAndRestaurants(center, searchRadius);

    // score & pick
    const best = await pickBestWalkingPOI(userLocs, pois);

    // done
    return best;  // a PlaceResult you can drop a marker on
}

