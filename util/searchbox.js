import { State } from './state.js';
import {addUserMarker, showLocation} from "./markers.js";

export async function setupSearchBox() {
    const input = document.getElementById("pac-input");
    const autocomplete = new google.maps.places.Autocomplete(input, {
        fields: ["geometry", "name", "formatted_address", "types"]    // only geographic locations
    });

    State.map.addListener("bounds_changed", () => {
        autocomplete.setBounds(State.map.getBounds());
    });

    autocomplete.addListener("place_changed", async () => {
        const place = autocomplete.getPlace();
        if (!place.geometry?.location) return;

        // only accept if it's an establishment OR a street_address/premise etc.
        const types = place.types || [];
        const isAddress = types.includes("street_address")
            || types.includes("premise")
            || types.includes("subpremise")
            || types.includes("route");
        const isEstablishment = types.includes("establishment");
        if (!isEstablishment && !isAddress) {
            console.log("Filtered out:", place.name, types);
            return;
        }

        // clear searchbox
        const searchBar = document.getElementById('pac-input');
        searchBar.value = "";

        // clear old markers
        // State.markers.forEach(m => m.setMap(null));
        // State.markers.length = 0;

        // await your async helper
        showLocation(place);
        await addUserMarker(place);
    });
}

