<script lang="ts">
  import type { Circle, Map as LeafletMap, Marker } from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import type { Position } from './db';

  // Klein kaartje in het bewerkformulier dat laat zien waar een waarneming
  // ligt, met de nauwkeurigheid als cirkel (gevraagd in de feedback: "GPS,
  // ±9 m" zegt niet waar je bent). Alleen kijken: niet slepen of zoomen, zodat
  // het scrollen door het formulier niet in de kaart blijft hangen. Tikken
  // opent het kaartje van Locatie aanpassen (`onopen`).

  let {
    position,
    onopen,
  }: {
    position: Position;
    onopen: () => void;
  } = $props();

  let container = $state<HTMLDivElement>();
  let map: LeafletMap | undefined;
  let marker: Marker | undefined;
  let circle: Circle | undefined;

  // Leaflet pas laden als het kaartje er staat, zoals in ObservationMap
  $effect(() => {
    if (!container) return;
    const element = container;
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled) return;

      const created = L.map(element, {
        zoomControl: false,
        dragging: false,
        touchZoom: false,
        doubleClickZoom: false,
        scrollWheelZoom: false,
        boxZoom: false,
        keyboard: false,
      });
      map = created;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(created);
      circle = L.circle([position.lat, position.lon], {
        radius: position.accuracy,
        className: 'accuracy',
        interactive: false,
      }).addTo(created);
      marker = L.marker([position.lat, position.lon], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          html: '<span class="dot"></span>',
          className: 'spot',
          iconSize: [22, 22],
        }),
      }).addTo(created);
      show(position);
      created.on('click', onopen);
    })();

    return () => {
      cancelled = true;
      map?.remove();
      map = undefined;
      marker = undefined;
      circle = undefined;
    };
  });

  /** Zo ingezoomd dat de cirkel past, maar niet verder dan straatniveau */
  function show(current: Position) {
    if (!map || !circle) return;
    map.setView([current.lat, current.lon], 17);
    const bounds = circle.getBounds();
    if (bounds.isValid() && current.accuracy > 40)
      map.fitBounds(bounds, { padding: [8, 8], maxZoom: 17 });
  }

  // Plek veranderd (met de hand gezet, "Terug naar de opgenomen plek"): mee
  $effect(() => {
    const current = position;
    if (!map || !marker || !circle) return;
    marker.setLatLng([current.lat, current.lon]);
    circle.setLatLng([current.lat, current.lon]).setRadius(current.accuracy);
    show(current);
  });

  $effect(() => {
    if (!container) return;
    const observer = new ResizeObserver(() => map?.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  });
</script>

<!-- Voor schermlezers en het toetsenbord: de regel erboven zegt het al, de knop
     Locatie aanpassen opent het kaartje; tikken op de kaart is een extraatje -->
<div class="map" bind:this={container}></div>

<style>
  .map {
    height: 9rem;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    z-index: 0;
    position: relative;
    cursor: pointer;
  }

  .map :global(.leaflet-container),
  .map:global(.leaflet-container) {
    cursor: pointer;
  }

  .map :global(.accuracy) {
    fill: var(--breast);
    fill-opacity: 0.15;
    stroke: var(--breast-strong);
    stroke-width: 1.5;
  }

  .map :global(.spot) {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .map :global(.spot .dot) {
    flex: none;
    width: 14px;
    height: 14px;
    border: 3px solid #fff;
    border-radius: 50%;
    background: var(--breast-strong);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.45);
  }
</style>
