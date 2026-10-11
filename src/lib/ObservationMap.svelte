<script lang="ts">
  import { liveQuery } from 'dexie';
  import type { CircleMarker, Map as LeafletMap } from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import type { Observation, Session } from './db';
  import { mapsUrl } from './devNotes';
  import { listObservations } from './observations';
  import { getSpecies } from './vocab';

  // Kaart met waar elke waarneming van een wandeling is gedaan. Alleen
  // bekijken; locaties verslepen kan later.

  /**
   * `focus`: waarneming die de lijst op de kaart wil laten zien.
   * `onselect`: een waarneming in het popup-venster aangetikt, voor de lijst.
   */
  let {
    session,
    focus,
    onselect,
  }: {
    session: Session;
    focus?: { id: string };
    onselect?: (ids: string[]) => void;
  } = $props();

  let observations = $derived(liveQuery(() => listObservations(session.id)));

  let container = $state<HTMLDivElement>();
  let map: LeafletMap | undefined;
  let fitted = false;
  /** Stip per waarneming, om er vanuit de lijst naartoe te gaan */
  let markers = new Map<string, CircleMarker>();

  const timeFormat = new Intl.DateTimeFormat('nl-NL', { timeStyle: 'short' });

  /**
   * Waarnemingen uit dezelfde uitspraak delen een positie; die komen samen in
   * één stip, anders liggen ze precies op elkaar.
   */
  function groupByPosition(list: Observation[]) {
    const groups = new Map<string, Observation[]>();
    for (const obs of list) {
      if (!obs.position) continue;
      const key = `${obs.position.lat},${obs.position.lon}`;
      groups.set(key, [...(groups.get(key) ?? []), obs]);
    }
    return [...groups.values()];
  }

  function escape(text: string): string {
    const el = document.createElement('span');
    el.textContent = text;
    return el.innerHTML;
  }

  /** Popup-venster bij een stip; elke waarneming is een knop naar de lijst */
  function popup(group: Observation[]): HTMLElement {
    const first = group[0];
    const { lat, lon, accuracy } = first.position!;
    const area = first.area?.name ? ` · ${escape(first.area.name)}` : '';
    const el = document.createElement('div');
    el.innerHTML = `<strong>${timeFormat.format(first.observedAt)}</strong>${area}`;
    for (const obs of group) {
      const name = getSpecies(obs.speciesId)?.name ?? `soort ${obs.speciesId}`;
      const mark = obs.uncertain ? ' <span class="uncertain">(onzeker)</span>' : '';
      const button = document.createElement('button');
      button.className = 'obs';
      button.innerHTML = `${obs.count}× ${escape(name)}${mark}`;
      button.onclick = () => onselect?.([obs.id]);
      el.append(button);
    }
    const footer = document.createElement('div');
    footer.className = 'accuracy';
    footer.innerHTML =
      `± ${Math.round(accuracy)} m · ` +
      `<a href="${mapsUrl(lat, lon)}" target="_blank" rel="noopener">kaarten-app</a>`;
    el.append(footer);
    return el;
  }

  // Leaflet pas laden als de kaart echt getoond wordt, zodat de rest van de
  // app er niet trager van wordt.
  $effect(() => {
    const list = $observations;
    if (!list) return;
    let cancelled = false;

    (async () => {
      const L = await import('leaflet');
      if (cancelled) return;

      // De kaart verdwijnt als alle waarnemingen weg zijn; daarna opnieuw opbouwen
      if (map && map.getContainer() !== container) {
        map.remove();
        map = undefined;
        fitted = false;
      }
      if (!container) return;
      if (!map) {
        map = L.map(container, { zoomControl: true });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
      }
      // Bij elke wijziging (bewerken, verwijderen) opnieuw tekenen
      map.eachLayer((layer) => {
        if (!(layer instanceof L.TileLayer)) layer.remove();
      });
      markers = new Map();

      const groups = groupByPosition(list);
      const bounds = L.latLngBounds([]);
      for (const group of groups) {
        const { lat, lon, accuracy } = group[0].position!;
        const uncertain = group.some((obs) => obs.uncertain);
        const color = uncertain ? '#7d6210' : '#6f7587';
        L.circle([lat, lon], {
          radius: accuracy,
          color,
          weight: 1,
          fillOpacity: 0.1,
          interactive: false,
        }).addTo(map);
        const marker = L.circleMarker([lat, lon], {
          radius: 7,
          color: '#fff',
          weight: 2,
          fillColor: color,
          fillOpacity: 1,
        })
          .bindPopup(popup(group))
          .addTo(map);
        for (const obs of group) markers.set(obs.id, marker);
        bounds.extend([lat, lon]);
      }

      // Alleen de eerste keer inzoomen, zodat bewerken het beeld niet laat verspringen
      if (!fitted) {
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 });
        else map.setView([52.2, 5.3], 7);
        fitted = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    return () => map?.remove();
  });

  // Vanuit de lijst: kaart in beeld, inzoomen op de stip en het popup-venster openen
  $effect(() => {
    if (!focus || !map) return;
    const marker = markers.get(focus.id);
    if (!marker) return;
    container?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    map.setView(marker.getLatLng(), Math.max(map.getZoom(), 17));
    marker.openPopup();
  });

  let withPosition = $derived($observations?.filter((obs) => obs.position).length ?? 0);
  let withoutPosition = $derived(($observations?.length ?? 0) - withPosition);
</script>

{#if $observations && $observations.length > 0}
  <section>
    <div class="map" bind:this={container}></div>
    {#if withoutPosition > 0}
      <p class="muted">
        {withoutPosition}
        {withoutPosition === 1 ? 'waarneming' : 'waarnemingen'} zonder locatie
        {withoutPosition === 1 ? 'staat' : 'staan'} niet op de kaart.
      </p>
    {/if}
  </section>
{/if}

<style>
  section {
    margin: 1rem 0;
  }

  .map {
    height: 22rem;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    /* Leaflet-panelen boven de rest van de pagina, maar onder dialogen */
    z-index: 0;
    position: relative;
  }

  .muted {
    margin: 0.5rem 0 0;
    font-size: 0.9rem;
    color: var(--muted);
  }

  .map :global(.leaflet-popup-content) {
    margin: 0.6rem 0.8rem;
    font: inherit;
    font-size: 0.95rem;
    line-height: 1.4;
  }

  /* Waarneming in het popup-venster: tik → naar de lijst */
  .map :global(button.obs) {
    display: block;
    margin: 0.15rem 0;
    padding: 0.1rem 0;
    border: none;
    font: inherit;
    text-align: left;
    /* Vaste kleur: het popup-venster is ook in donkere modus wit */
    color: #545a6b;
    background: none;
    text-decoration: underline dotted;
    text-underline-offset: 0.2em;
    cursor: pointer;
  }

  .map :global(.uncertain) {
    color: #7d6210;
  }

  .map :global(.accuracy) {
    color: #65707a;
    font-size: 0.85rem;
  }

  .map :global(.accuracy a) {
    color: inherit;
  }
</style>
