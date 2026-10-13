<script lang="ts">
  import { liveQuery } from 'dexie';
  import type { Map as LeafletMap, Marker } from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import type { Observation, Session } from './db';
  import { mapsUrl } from './devNotes';
  import { listObservations } from './observations';
  import { hasRarity, rarityLabels, raritySvg } from './rarity';
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
  let markers = new Map<string, Marker>();

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
      // Number(): ook als er via een import iets anders dan een getal in staat,
      // komt er geen HTML in het popup-venster
      button.innerHTML = `${popupMark(rarityOf(obs))}${Number(obs.count)}× ${escape(name)}${mark}`;
      button.onclick = () => onselect?.([obs.id]);
      el.append(button);
    }
    const footer = document.createElement('div');
    footer.className = 'accuracy';
    const link = document.createElement('a');
    link.href = mapsUrl(Number(lat), Number(lon));
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'kaarten-app';
    footer.append(`± ${Math.round(accuracy)} m · `, link);
    el.append(footer);
    return el;
  }

  function rarityOf(obs: Observation): number {
    return getSpecies(obs.speciesId)?.rarity ?? 0;
  }

  /** Vormpje in het popup-venster, zoals in de lijst: bij onbekend een lege plek */
  function popupMark(rarity: number): string {
    return hasRarity(rarity) ? raritySvg(rarity, 'rarity') : '<span class="rarity"></span>';
  }

  /** Stip op de kaart; onzeker krijgt een vraagteken, los van de kleur van de vorm */
  function pinHtml(rarity: number, uncertain: boolean): string {
    const badge = uncertain ? '<span class="pin-uncertain">?</span>' : '';
    return raritySvg(rarity, 'pin') + badge;
  }

  /** Naam van de stip voor schermlezers (Leaflet maakt er een knop van) */
  function pinTitle(group: Observation[], rarity: number, uncertain: boolean): string {
    const names = group.map((obs) => getSpecies(obs.speciesId)?.name ?? `soort ${obs.speciesId}`);
    const parts = [names.join(', ')];
    if (hasRarity(rarity)) parts.push(rarityLabels[rarity]);
    if (uncertain) parts.push('onzeker');
    return parts.join(' · ');
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
        L.circle([lat, lon], {
          radius: accuracy,
          color: uncertain ? '#7d6210' : '#6f7587',
          weight: 1,
          fillOpacity: 0.1,
          interactive: false,
        }).addTo(map);
        // Meerdere soorten op één plek: de zeldzaamste bepaalt de stip
        const rarity = Math.max(...group.map(rarityOf));
        const marker = L.marker([lat, lon], {
          icon: L.divIcon({
            html: pinHtml(rarity, uncertain),
            className: 'pin-icon',
            iconSize: [20, 20],
          }),
          title: pinTitle(group, rarity, uncertain),
          // Zeldzame soorten bovenop
          zIndexOffset: rarity * 100,
        })
          .bindPopup(() => popup(group))
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

  /* Stip op de kaart: wit randje */
  .map :global(svg.pin) {
    display: block;
    width: 20px;
    height: 20px;
    stroke: #fff;
    stroke-width: 1.5;
    stroke-linejoin: round;
    filter: drop-shadow(0 1px 1px rgb(0 0 0 / 0.35));
  }

  /* Onzeker: bruin vraagteken rechtsboven, goed te zien op elke kleur */
  .map :global(.pin-uncertain) {
    position: absolute;
    top: -7px;
    right: -8px;
    width: 13px;
    height: 13px;
    border: 1.5px solid #fff;
    border-radius: 50%;
    font:
      bold 10px/13px system-ui,
      sans-serif;
    text-align: center;
    color: #fff;
    background: #7d6210;
  }

  /* Vormpje voor de soort in het popup-venster, zoals in de lijst */
  .map :global(.rarity) {
    display: inline-block;
    width: 0.75rem;
    height: 0.75rem;
    margin-right: 0.35rem;
    vertical-align: -0.05rem;
  }

  .map :global(.accuracy) {
    color: #65707a;
    font-size: 0.85rem;
  }

  .map :global(.accuracy a) {
    color: inherit;
  }
</style>
