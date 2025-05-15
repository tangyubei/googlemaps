export * from "./show-map.js"
export {setupSearchBox} from "./searchbox.js"
export * from "./markers.js"
import {initMap} from "./show-map.js"
import {findBestWalkingCafeOrRestaurant} from "./places-search.js"
import {State} from "./state.js"
import {addDestinationMarker} from "./markers.js";

document.addEventListener('DOMContentLoaded', () => {
    initMap();

    const goBtn = document.getElementById('go-button');
    goBtn.addEventListener('click', async () => {
        const userLocs = State.markers.map(m => ({ lat: m.position.lat, lng: m.position.lng }));

        findBestWalkingCafeOrRestaurant(userLocs)
            .then(place => {
                console.log('Meet at:', place.name, place.vicinity);
                new google.maps.Marker({
                    map:      State.map,
                    position: place.geometry.location,
                    title:    place.name,
                });
                State.map.panTo(place.geometry.location);
                State.map.setZoom(15);
            })
            .catch(err => {
                console.error('Couldn’t find a walking meetup spot:', err);
            });
    });
});
