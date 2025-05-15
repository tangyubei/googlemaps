import {PINS} from './config.js';
import {State} from './state.js';

let AdvancedMarkerElement, PinElement;

export async function addUserMarker(place) {
    const markerLib = await google.maps.importLibrary('marker');
    AdvancedMarkerElement = markerLib.AdvancedMarkerElement;
    PinElement = markerLib.PinElement;
    const initialPin = new PinElement({background: PINS.user});
    const marker = new AdvancedMarkerElement({
        map: State.map,
        position: place.geometry.location,
        title: place.name,
        content: initialPin.element,
    });
    State.markers.push(marker);

    const bounds = new google.maps.LatLngBounds();
    State.markers.forEach(m => bounds.extend(m.position));
    State.map.fitBounds(bounds);

    const maxAllowed = 15;
    if (State.map.getZoom() > maxAllowed) {
        State.map.setZoom(maxAllowed);
    }

    const listGroup = document.getElementById('list-group');
    marker.addEventListener("mouseenter", () => {
        const index = State.markers.indexOf(marker);
        const nthLi = listGroup.children[index];
        nthLi.classList.add('highlighted');
        swapPin(index, "yellow")
    })

    marker.addEventListener("mouseleave", () => {
        const index = State.markers.indexOf(marker);
        const nthLi = listGroup.children[index];
        nthLi.classList.remove('highlighted');
        swapPin(index, "#4285F4")
    })
}

export function showLocation(place) {
    const listGroup = document.getElementById('list-group');
    const li = document.createElement('li');
    li.className = 'list-group-item';
    li.textContent = place.name;

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
        swapPin(index, PINS.user);
    });

    listGroup.appendChild(li);
}

function swapPin(i, color) {
    const marker = State.markers[i]
    const newPin = new PinElement({background: color});
    marker.content = newPin.element;
}

export function addDestinationMarker(place) {
    const initialPin = new PinElement({background: 'red'});
    const marker = new AdvancedMarkerElement({
        map: State.map,
        position: place.geometry.location,
        title: place.name,
        content: initialPin.element,
    });
}
