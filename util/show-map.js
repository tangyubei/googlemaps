import { State } from './state.js';
import { DEFAULT_POSITION } from './config.js';
import {setupSearchBox} from "./searchbox.js";

export async function initMap() {
    // Load the maps and marker libraries
    const {Map} = await google.maps.importLibrary("maps");

    // Create the map
    State.map = new Map(document.getElementById("map"), {
        center: DEFAULT_POSITION,
        zoom: 15,
        mapId: "DEMO_MAP_ID",
        disableDefaultUI: true,
        gestureHandling: "greedy",
        zoomControl: true
    });

    // Pan to user location
    showInitialView();

    // Set up search box
    setupSearchBox();
    //addUserMarker({lat: 41.944924, lng: -87.8883936,})
}

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

function handleLocationError(browserHasGeolocation, pos) {
    State.infoWindow.setPosition(pos);
    State.infoWindow.setContent(
        browserHasGeolocation
            ? "Error: The Geolocation service failed."
            : "Error: Your browser doesn't support geolocation."
    );
    State.infoWindow.open(map);
}