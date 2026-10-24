<script lang="ts">
  import { liveQuery } from 'dexie';
  import type {
    Circle,
    LatLng,
    Map as LeafletMap,
    Marker,
    MarkerCluster,
    MarkerClusterGroup,
    TileLayer,
  } from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import 'leaflet.markercluster/dist/MarkerCluster.css';
  import type { Observation, Session } from './db';
  import { mapsUrl } from './devNotes';
  import { byTime, clusterAction, groupByPosition, summarize } from './mapGroups';
  import { listObservations } from './observations';
  import { hasRarity, rarityLabels, rarityOf, raritySvg } from './rarity';
  import { speciesName } from './vocab';

  // Kaart met waar elke waarneming van een wandeling is gedaan. Alleen
  // bekijken; locaties verslepen kan later. Stippen die op het scherm
  // overlappen (lang op één plek, bv. een vogelhut) worden één bolletje met
  // het aantal waarnemingen (leaflet.markercluster).

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
  let tiles: TileLayer | undefined;
  let clusters: MarkerClusterGroup | undefined;
  let fitted = false;
  /** Stip per waarneming, om er vanuit de lijst naartoe te gaan */
  let markers = new Map<string, Marker>();
  /** Waarnemingen per stip, voor het popup-venster van een cluster */
  let groupOf = new Map<Marker, Observation[]>();

  const timeFormat = new Intl.DateTimeFormat('nl-NL', { timeStyle: 'short' });
  /** Popup-venster niet achter de zoomknoppen linksboven */
  const popupOptions = { autoPanPaddingTopLeft: [52, 10] as [number, number] };

  /** Element met tekst (nooit HTML) of andere elementen erin */
  function el(tag: string, className: string, ...children: (Node | string)[]): HTMLElement {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.append(...children);
    return node;
  }

  /**
   * Knop per waarneming in het popup-venster, naar de lijst. Met
   * DOM-elementen en textContent, niet met innerHTML: gegevens uit de
   * database (ook uit een import) komen zo nooit als HTML in de pagina.
   */
  function obsButton(obs: Observation, withTime: boolean): HTMLElement {
    const label = `${obs.count}× ${speciesName(obs.speciesId)}`;
    const button = el(
      'button',
      'obs',
      withTime ? `${timeFormat.format(obs.observedAt)} · ${label}` : label,
    );
    // Vormpje zoals in de lijst (uit vaste waarden); bij onbekend een lege plek
    const rarity = rarityOf(obs.speciesId);
    if (hasRarity(rarity)) button.insertAdjacentHTML('afterbegin', raritySvg(rarity, 'rarity'));
    else button.prepend(el('span', 'rarity'));
    if (obs.uncertain) button.append(' ', el('span', 'uncertain', '(onzeker)'));
    button.onclick = () => onselect?.([obs.id]);
    return button;
  }

  /** Popup-venster bij een stip: één uitspraak, één tijd en positie */
  function popup(group: Observation[]): HTMLElement {
    const first = group[0];
    const { lat, lon, accuracy } = first.position!;
    const content = el('div', '', el('strong', '', timeFormat.format(first.observedAt)));
    if (first.area?.name) content.append(` · ${first.area.name}`);
    for (const obs of group) content.append(obsButton(obs, false));
    const link = el('a', '', 'kaarten-app') as HTMLAnchorElement;
    link.href = mapsUrl(lat, lon);
    link.target = '_blank';
    link.rel = 'noopener';
    content.append(el('div', 'accuracy', `± ${Math.round(accuracy)} m · `, link));
    return content;
  }

  /** Popup-venster bij een cluster: alle waarnemingen op tijd, en eventueel inzoomen */
  function clusterPopup(list: Observation[], zoomIn?: () => void): HTMLElement {
    const sorted = byTime(list);
    const from = timeFormat.format(sorted[0].observedAt);
    const to = timeFormat.format(sorted[sorted.length - 1].observedAt);
    const content = el(
      'div',
      'cluster-list',
      el('strong', '', `${list.length} waarnemingen`),
      from === to ? ` · ${from}` : ` · ${from}–${to}`,
    );
    for (const obs of sorted) content.append(obsButton(obs, true));
    if (zoomIn) {
      const button = el('button', 'zoom-in link', 'Inzoomen');
      button.onclick = zoomIn;
      content.append(button);
    }
    return content;
  }

  /** Stip op de kaart; onzeker krijgt een vraagteken, los van de kleur van de vorm */
  function pinHtml(rarity: number, uncertain: boolean): string {
    const badge = uncertain ? '<span class="pin-uncertain">?</span>' : '';
    return raritySvg(rarity, 'pin') + badge;
  }

  /**
   * Cluster: het aantal waarnemingen, met de vorm van de zeldzaamste soort
   * als stipje eronder en het vraagteken als er iets onzekers in zit. Alleen
   * getallen en vaste waarden, geen gegevens uit de database als tekst.
   */
  function clusterHtml(count: number, rarity: number, uncertain: boolean): string {
    const badge = uncertain ? '<span class="pin-uncertain">?</span>' : '';
    return (
      `<span class="cluster-count">${count}<span class="sr-only"> waarnemingen</span></span>` +
      raritySvg(rarity, 'cluster-rarity') +
      badge
    );
  }

  /** Naam van de stip voor schermlezers (Leaflet maakt er een knop van) */
  function pinTitle(group: Observation[], rarity: number, uncertain: boolean): string {
    const parts = [group.map((obs) => speciesName(obs.speciesId)).join(', ')];
    if (hasRarity(rarity)) parts.push(rarityLabels[rarity]);
    if (uncertain) parts.push('onzeker');
    return parts.join(' · ');
  }

  function clusterObservations(cluster: MarkerCluster): Observation[] {
    return cluster.getAllChildMarkers().flatMap((marker) => groupOf.get(marker) ?? []);
  }

  // Leaflet pas laden als de kaart echt getoond wordt, zodat de rest van de
  // app er niet trager van wordt.
  $effect(() => {
    const list = $observations;
    if (!list) return;
    let cancelled = false;

    (async () => {
      // markercluster breidt de globale L uit; Leaflet zelf zet die niet als
      // module, dus eerst hier neerzetten
      const L = (await import('leaflet')).default;
      (window as unknown as { L: typeof L }).L = L;
      await import('leaflet.markercluster');
      if (cancelled) return;

      // De kaart verdwijnt als alle waarnemingen weg zijn; daarna opnieuw opbouwen
      if (map && map.getContainer() !== container) {
        map.remove();
        map = undefined;
        fitted = false;
      }
      if (!container) return;
      if (!map) {
        const created = L.map(container, { zoomControl: true, maxZoom: 19 });
        map = created;
        tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(created);
        clusters = L.markerClusterGroup({
          // Standaard 80 px; zo blijven stippen los zolang ze los te zien zijn
          maxClusterRadius: 40,
          showCoverageOnHover: false,
          // Tikken handelen we zelf af (lijst of inzoomen), hieronder
          zoomToBoundsOnClick: false,
          spiderfyOnMaxZoom: false,
          iconCreateFunction: (cluster) => {
            const list = clusterObservations(cluster);
            const { rarity, uncertain } = summarize(list);
            return L.divIcon({
              html: clusterHtml(list.length, rarity, uncertain),
              className: 'cluster-icon',
              iconSize: [34, 34],
            });
          },
        }).addTo(created);
        clusters.on('clusterclick', (event) => {
          const cluster = (event as unknown as { layer: MarkerCluster }).layer;
          const list = clusterObservations(cluster);
          const zoomIn = () => {
            created.closePopup();
            cluster.zoomToBounds({ padding: [24, 24] });
          };
          const canZoomIn = created.getZoom() < created.getMaxZoom();
          if (clusterAction(list.length, canZoomIn) === 'zoom') zoomIn();
          else
            L.popup(popupOptions)
              .setLatLng(cluster.getLatLng())
              .setContent(clusterPopup(list, canZoomIn ? zoomIn : undefined))
              .openOn(created);
        });
      }
      const current = map;

      // Bij elke wijziging (bewerken, verwijderen) opnieuw tekenen
      current.closePopup();
      clusters!.clearLayers();
      current.eachLayer((layer) => {
        if (layer instanceof L.Circle) layer.remove();
      });
      markers = new Map();
      groupOf = new Map();

      const groups = groupByPosition(list);
      const bounds = L.latLngBounds([]);
      const pins: Marker[] = [];
      for (const group of groups) {
        const { lat, lon, accuracy } = group[0].position!;
        const { rarity, uncertain } = summarize(group);
        // Nauwkeurigheid alleen bij een open venster; allemaal tegelijk wordt een vlek
        const circle: Circle = L.circle([lat, lon], {
          radius: accuracy,
          color: uncertain ? '#7d6210' : '#6f7587',
          weight: 1,
          fillOpacity: 0.1,
          interactive: false,
        });
        // Meerdere soorten op één plek: de zeldzaamste bepaalt de stip
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
          .bindPopup(() => popup(group), popupOptions)
          .on('popupopen', () => circle.addTo(current))
          .on('popupclose', () => circle.remove());
        pins.push(marker);
        groupOf.set(marker, group);
        for (const obs of group) markers.set(obs.id, marker);
        bounds.extend([lat, lon]);
      }
      clusters!.addLayers(pins);

      // Alleen de eerste keer inzoomen, zodat bewerken het beeld niet laat verspringen
      if (!fitted) {
        if (bounds.isValid()) current.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 });
        else current.setView([52.2, 5.3], 7);
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

  /**
   * Soms bleef de kaart een zwart vlak (15 okt, in de app): gemaakt voordat
   * het vak zijn maat had, of tegels die bij slecht bereik mislukten. Leaflet
   * probeert dat zelf niet opnieuw; dit wel, en met de hand via de knop.
   */
  function reload() {
    map?.invalidateSize();
    tiles?.redraw();
  }

  $effect(() => {
    if (!container) return;
    const observer = new ResizeObserver(() => map?.invalidateSize());
    observer.observe(container);
    window.addEventListener('online', reload);
    return () => {
      observer.disconnect();
      window.removeEventListener('online', reload);
    };
  });

  // Vanuit de lijst: kaart in beeld, de stip uit zijn cluster halen
  // (inzoomen of uitwaaieren) en het popup-venster openen
  $effect(() => {
    if (!focus || !map || !clusters) return;
    const marker = markers.get(focus.id);
    if (!marker) return;
    const current = map;
    container?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const target: LatLng = marker.getLatLng();
    current.setView(target, Math.max(current.getZoom(), 17), { animate: false });
    clusters.zoomToShowLayer(marker, () => marker.openPopup());
  });

  let withPosition = $derived($observations?.filter((obs) => obs.position).length ?? 0);
  let withoutPosition = $derived(($observations?.length ?? 0) - withPosition);
</script>

{#if $observations && $observations.length > 0}
  <section>
    <div class="map" bind:this={container}></div>
    <p class="muted">
      {#if withoutPosition > 0}
        {withoutPosition}
        {withoutPosition === 1 ? 'waarneming' : 'waarnemingen'} zonder locatie
        {withoutPosition === 1 ? 'staat' : 'staan'} niet op de kaart.
      {/if}
      <button type="button" class="link" onclick={reload}>Kaart opnieuw laden</button>
    </p>
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
  /* 17 px in een icoon van 20: het witte randje valt buiten de vorm */
  .map :global(svg.pin) {
    display: block;
    width: 17px;
    height: 17px;
    margin: 1.5px;
    overflow: visible;
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

  /* Cluster: wit bolletje met het aantal, vormpje van de zeldzaamste soort eronder */
  .map :global(.cluster-icon) {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #545a6b;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.35);
  }

  .map :global(.cluster-count) {
    font:
      bold 14px/1 system-ui,
      sans-serif;
    color: #24221f;
  }

  .map :global(svg.cluster-rarity) {
    position: absolute;
    bottom: -6px;
    left: 50%;
    width: 13px;
    height: 13px;
    margin-left: -6.5px;
    overflow: visible;
    stroke: #fff;
    stroke-width: 1.5;
    stroke-linejoin: round;
  }

  .map :global(.cluster-icon .pin-uncertain) {
    top: -6px;
    right: -6px;
  }

  .map :global(.sr-only) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /* Lijst bij een cluster: niet hoger dan de kaart, dan scrollen */
  .map :global(.cluster-list) {
    max-height: 15rem;
    overflow-y: auto;
  }

  .map :global(button.zoom-in) {
    margin-top: 0.4rem;
    padding: 0.4rem 0;
    /* Vaste kleur: het popup-venster is ook in donkere modus wit */
    color: #545a6b;
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
