// src/map.js

import { State } from './state.js';

import {setupSearchBox} from "./";

//let map;
let infoWindow;
let markers = [];
let AdvancedMarkerElement, PinElement;
const listGroup = document.getElementById('list-group');
const markerColor = {
    highlight: "yellow",
    location: "blue",
    destination: "red",
};
let directionsService, directionsRenderer;
let cachedRoutes = [];
const routeRenderers = [];
/**
 * Initializes the Google Map and core libraries.
 */
export async function initMap() {
    // Load the maps and marker libraries
    const {Map} = await google.maps.importLibrary("maps");
    const markerLib = await google.maps.importLibrary('marker');
    AdvancedMarkerElement = markerLib.AdvancedMarkerElement;
    PinElement = markerLib.PinElement;

    // Create the map
    const defaultPos = {lat: -25.344, lng: 131.031};
    State.map = new Map(document.getElementById("map"), {
        center: defaultPos,
        zoom: 15,
        maxZoom: 15,
        mapId: "DEMO_MAP_ID",
        disableDefaultUI: true,
        gestureHandling: "greedy",
        zoomControl: true
    });
    directionsService  = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: State.map,
        suppressMarkers: true,    // set to true if you want custom markers
    });
    //calcAndDisplayRoute({lat: 41.8796031, lng: -87.6223504},{lat:41.8789151, lng:-87.6464873});

    // Reusable InfoWindow
    infoWindow = new google.maps.InfoWindow();

    // Pan to user location
    showInitialView();

    // Set up search box
    setupSearchBox();

}

/**
 * Adds an AdvancedMarkerElement for the given place.
 */
export function addUserMarker(place) {
    console.log("usermarker");
    const initialPin = new PinElement({background: '#4285F4'});
    const marker = new AdvancedMarkerElement({
        map: State.map,
        position: place.geometry.location,
        title: place.name,
        content: initialPin.element,
    });
    markers.push(marker);

    // now wire up hover
    marker.addEventListener("mouseenter", () => {
        const index = markers.indexOf(marker);
        const nthLi = listGroup.children[index];
        nthLi.classList.add('highlighted');
        swapPin(index, "yellow" )
    })

    marker.addEventListener("mouseleave", () => {
        const index = markers.indexOf(marker);
        const nthLi = listGroup.children[index];
        nthLi.classList.remove('highlighted');
        swapPin(index, "#4285F4" )
    })
}

function addDestinationMarker(place) {
    const initialPin = new PinElement({background: 'red'});
    const marker = new AdvancedMarkerElement({
        map,
        position: place.geometry.location,
        title: place.name,
        content: initialPin.element,
    });
}

/**
 * Swaps pin color
 */
function swapPin(i, color) {
    const marker = markers[i]
    const newPin = new PinElement({background: color});
    marker.content = newPin.element;
}

/**
 * Appends the place name to a list in the DOM.
 */
export function showLocation(place) {
    const listGroup = document.getElementById('list-group');

    const li = document.createElement('li');
    li.className = 'list-group-item';
    li.textContent = place.name;
    console.log(place);

    li.addEventListener('mouseover', event => {
        console.log('hovered over:', event.target.textContent);
        // get a live HTMLCollection of all <li> siblings
        const siblings = listGroup.children;
        // find this <li>'s index
        const index = Array.prototype.indexOf.call(siblings, li);
        console.log('hovered index:', index);
        swapPin(index, "yellow");
    });

    li.addEventListener('mouseout', () => {
        const siblings = listGroup.children;
        const index = Array.prototype.indexOf.call(siblings, li);
        swapPin(index, '#4285F4');
    });

    listGroup.appendChild(li);
}

/**
 * Centers the map on the geographic centroid of all markers.
 */
export async function showCentroid() {
    if (!markers.length) return;
    const midLat = markers.reduce((sum, m) => sum + m.position.lat, 0) / markers.length;
    const midLon = markers.reduce((sum, m) => sum + m.position.lng, 0) / markers.length;
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
    const promises = markers.map(m =>
        calcAndCacheRoute(m.position, centralLoc, google.maps.TravelMode.WALKING)
    );
    // Wait for every route to finish caching
    await Promise.all(promises);

    // Now draw them all
    showAllCachedRoutes();
}

/**
 * NearbySearch to generate closest venue
 */
function addNearestPlace(type, lat, lng) {
    return new Promise((resolve, reject) => {
        const loc = new google.maps.LatLng(lat, lng);
        const service = new google.maps.places.PlacesService(map);
        service.nearbySearch({
            location: loc,
            rankBy: google.maps.places.RankBy.DISTANCE,
            type,
        }, (results, status) => {
            if (status !== google.maps.places.PlacesServiceStatus.OK || !results[0]) {
                return reject(status);
            }
            const r = results[0].geometry.location;
            // add marker if you like
            addDestinationMarker(results[0]);
            // resolve with plain object
            resolve({lat: r.lat(), lng: r.lng()});

        });
    });
}

/**
 * Handle geolocation errors.
 */
function handleLocationError(browserHasGeolocation, pos) {
    infoWindow.setPosition(pos);
    infoWindow.setContent(
        browserHasGeolocation
            ? "Error: The Geolocation service failed."
            : "Error: Your browser doesn't support geolocation."
    );
    infoWindow.open(map);
}

/**
 * Pan initial view to user location.
 */
function showInitialView() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            ({coords}) => {
                const pos = {lat: coords.latitude, lng: coords.longitude};
                State.map.setCenter(pos);
            },
            () => handleLocationError(true, State.map.getCenter())
        );
    } else {
        handleLocationError(false, map.getCenter());
    }
}

function calcAndCacheRoute(origin, destination, travelMode) {
    const request = { origin, destination, travelMode };
    const key = JSON.stringify(request);

    // don’t refetch if already cached
    if (cachedRoutes.some(r => r.key === key)) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        directionsService.route(request, (response, status) => {
            if (status === "OK") {
                cachedRoutes.push({ key, response });
                resolve();
            } else {
                console.error("Directions request failed:", status);
                reject(status);
            }
        });
    });
}

function showAllCachedRoutes() {
    // 1) For each saved route, create a new renderer and draw it
    cachedRoutes.forEach(({ response }, idx) => {
        const renderer = new google.maps.DirectionsRenderer({
            map: map,
            suppressMarkers: true,       // show default origin/destination markers
            polylineOptions: {
                strokeOpacity: 0.7,
                strokeWeight: 4,
                // optional: give each route a different color
                // strokeColor: ["#FF0000","#00FF00","#0000FF"][idx % 3]
            }
        });
        renderer.setDirections(response);
        routeRenderers.push(renderer);
    });
}