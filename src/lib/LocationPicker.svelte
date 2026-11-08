<script lang="ts">
  import type { Map as LeafletMap, Marker } from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import type { Position } from './db';
  import { listObservations } from './observations';

  // Kaartje in het bewerkformulier om de plek van één waarneming met de hand
  // te zetten: tik op de kaart of sleep de stip. Geeft elke nieuwe plek door
  // met `onplace`; opslaan doet het formulier.

  let {
    position,
    sessionId,
    onplace,
  }: {
    position?: Position;
    /** Zonder positie: beginnen bij de andere waarnemingen van de sessie */
    sessionId: string;
    onplace: (lat: number, lon: number) => void;
  } = $props();

  let container = $state<HTMLDivElement>();
  let map: LeafletMap | undefined;
  let marker: Marker | undefined;
  let setMarker: ((lat: number, lon: number) => void) | undefined;

  // Leaflet pas laden als het kaartje open gaat, zoals in ObservationMap
  $effect(() => {
    if (!container) return;
    const element = container;
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      const others = position ? [] : await listObservations(sessionId);
      if (cancelled) return;

      const created = L.map(element, { zoomControl: true, maxZoom: 19 });
      map = created;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(created);

      if (position) {
        created.setView([position.lat, position.lon], 17);
      } else {
        const bounds = L.latLngBounds(
          others.flatMap((obs) => (obs.position ? [[obs.position.lat, obs.position.lon]] : [])) as [
            number,
            number,
          ][],
        );
        if (bounds.isValid()) created.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 });
        else created.setView([52.2, 5.3], 7);
      }

      setMarker = (lat, lon) => {
        if (marker) {
          marker.setLatLng([lat, lon]);
          return;
        }
        marker = L.marker([lat, lon], {
          draggable: true,
          autoPan: true,
          title: 'Plek van de waarneming (te verslepen)',
          icon: L.divIcon({
            html: '<span class="dot"></span>',
            className: 'pick',
            iconSize: [28, 28],
          }),
        })
          .on('dragend', () => {
            const { lat, lng } = marker!.getLatLng();
            onplace(lat, lng);
          })
          .addTo(created);
      };
      if (position) setMarker(position.lat, position.lon);

      created.on('click', (event) => {
        const { lat, lng } = event.latlng;
        setMarker?.(lat, lng);
        onplace(lat, lng);
      });
    })();

    return () => {
      cancelled = true;
      map?.remove();
      map = undefined;
      marker = undefined;
      setMarker = undefined;
    };
  });

  // Plek van buitenaf veranderd ("Terug naar de opgenomen plek"): stip mee
  $effect(() => {
    const current = position;
    if (!current || !map || !setMarker) return;
    setMarker(current.lat, current.lon);
    if (!map.getBounds().contains([current.lat, current.lon]))
      map.panTo([current.lat, current.lon]);
  });

  $effect(() => {
    if (!container) return;
    const observer = new ResizeObserver(() => map?.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  });
</script>

<div class="map" bind:this={container}></div>
<p class="hint">Tik op de kaart of sleep de stip naar de plek van de vogel.</p>

<style>
  .map {
    height: 16rem;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    z-index: 0;
    position: relative;
  }

  .hint {
    margin: 0.3rem 0 0;
    font-size: 0.85rem;
    color: var(--muted);
  }

  /* Ruim te pakken met een vinger; zichtbaar op elke ondergrond */
  .map :global(.pick) {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .map :global(.pick .dot) {
    width: 18px;
    height: 18px;
    border: 3px solid #fff;
    border-radius: 50%;
    background: var(--breast-strong);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.45);
  }
</style>
