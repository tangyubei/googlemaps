/**
 * Sets up the Places SearchBox and handles place selection.
 */
import { State } from './state.js';
import {showLocation, addUserMarker} from "./";

export function setupSearchBox() {
    const input = document.getElementById("pac-input");
    // const searchBox = new google.maps.places.SearchBox(input);
    // 1. Create an Autocomplete that only returns addresses/geocodes
    const autocomplete = new google.maps.places.Autocomplete(input, {
        types: ['geocode']    // only geographic locations, no businesses
    });
    // Bias search to viewport
    State.map.addListener("bounds_changed", () => {
        autocomplete.setBounds(State.map.getBounds());
    });

    // Handle place selection
    autocomplete.addListener("places_changed", () => {
        const places = autocomplete.getPlaces();
        if (!places?.length) return;

        // Clear existing markers
        // markers.forEach(m => m.setMap(null));
        // markers = [];

        // Build bounds to fit
        const bounds = new google.maps.LatLngBounds();
        places.forEach(place => {
            if (!place.geometry?.location) return;
            console.log("placesforeach")
            addUserMarker(place);
            showLocation(place);
            const searchBar = document.getElementById('pac-input');
            searchBar.value = "";

            markers.forEach(m => {
                // m.position is a LatLngLiteral {lat, lng}
                bounds.extend(m.position);
            });

            //
            // if (place.geometry.viewport) {
            //     bounds.union(place.geometry.viewport);
            // } else {
            //     bounds.extend(place.geometry.location);
            // }
        });
        State.map.fitBounds(bounds);
    });
}
