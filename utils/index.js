export * from "./searchbox.js"
export * from "./map.js"
import { initMap, showCentroid } from './map.js';

document.addEventListener('DOMContentLoaded', () => {
    initMap();

    // Wire up the 'Go' button to compute/show centroid
    const goBtn = document.getElementById('go-button');
    goBtn.addEventListener('click', showCentroid);
});

