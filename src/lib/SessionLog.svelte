<script lang="ts">
  import { liveQuery } from 'dexie';
  import { tick, untrack } from 'svelte';
  import { audioBlob, type Observation, type Session, type Utterance } from './db';
  import { fillMissingAreas } from './area';
  import { mapsUrl } from './devNotes';
  import ObservationEditor from './ObservationEditor.svelte';
  import RarityMark from './RarityMark.svelte';
  import {
    confirmObservation,
    countSpecies,
    deleteObservation,
    listDeleted,
    listObservations,
    listUtterances,
    restoreObservation,
    retry,
    setSkipExport,
    spokenAt,
  } from './observations';
  import {
    DEFAULT_COUNTING_METHOD,
    allActivities,
    allLifeStages,
    allMethods,
    codeName,
    countingMethods,
    getSpecies,
  } from './vocab';

  // Waarnemingen en uitspraken van één wandeling; gebruikt voor de lopende
  // wandeling en voor eerdere wandelingen.

  /**
   * Bij de review staat er een kaart boven de lijst:
   * `focus`: waarnemingen die op de kaart zijn aangetikt, om op te laten lichten.
   * `onshowonmap`: een waarneming op de kaart laten zien (in plaats van de kaarten-app).
   */
  let {
    session,
    focus,
    onshowonmap,
  }: {
    session: Session;
    focus?: { ids: string[] };
    onshowonmap?: (id: string) => void;
  } = $props();

  // Opnieuw opvragen als de wandeling wisselt; liveQuery volgt daarna zelf de database
  let observations = $derived(liveQuery(() => listObservations(session.id)));
  let utterances = $derived(liveQuery(() => listUtterances(session.id)));
  let deleted = $derived(liveQuery(() => listDeleted(session.id)));

  // Gebiedsnamen die nog ontbreken (geen verbinding, oudere wandelingen) alsnog opzoeken
  $effect(() => {
    fillMissingAreas(session.id);
  });

  let queued = $derived(
    $utterances?.filter((u) => u.status === 'pending' || u.status === 'processing').length ?? 0,
  );

  let failed = $derived($utterances?.filter((u) => u.status === 'failed').length ?? 0);

  let utteranceById = $derived(new Map(($utterances ?? []).map((u) => [u.id, u])));

  /** De waarneming die nu bewerkt wordt (één tegelijk) */
  let editing = $state<string>();

  // Het formulier krijgt een eigen stap in de geschiedenis (zelfde URL), zodat
  // de terugknop van Android het formulier sluit in plaats van de app.
  function openEditor(id: string) {
    // Staat er nog een stap van vóór een herstart van de app, dan die hergebruiken
    if (editing === undefined && !history.state?.editor) history.pushState({ editor: true }, '');
    editing = id;
  }

  /** Opslaan, Annuleren of Verwijderen: de eigen stap weer uit de geschiedenis */
  function closeEditor() {
    if (history.state?.editor) history.back();
    else editing = undefined;
  }

  $effect(() => {
    const onPopState = () => {
      if (!history.state?.editor) editing = undefined;
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  });

  let onlyUncertain = $state(false);
  let uncertainCount = $derived($observations?.filter((obs) => obs.uncertain).length ?? 0);
  let shown = $derived(
    ($observations ?? []).filter((obs) => !onlyUncertain || obs.uncertain || obs.id === editing),
  );

  let speciesCount = $derived(countSpecies($observations ?? []));

  /** Waarnemingen die even oplichten, na een tik op de kaart */
  let flashing = $state<string[]>([]);

  $effect(() => {
    if (!focus) return;
    const ids = focus.ids;
    // Verborgen door het filter "Alleen onzeker"? Dan het filter uit.
    untrack(() => {
      if (ids.some((id) => !shown.some((obs) => obs.id === id))) onlyUncertain = false;
    });
    flashing = ids;
    tick().then(() =>
      document
        .getElementById(`obs-${ids[0]}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    );
    const timer = setTimeout(() => (flashing = []), 2500);
    return () => clearTimeout(timer);
  });

  const deletedByLabel = { hand: 'met de hand', voice: 'met de stem', undo: 'ongedaan gemaakt' };

  const timeFormat = new Intl.DateTimeFormat('nl-NL', { timeStyle: 'short' });

  function details(obs: Observation) {
    return [...behaviour(obs), obs.area?.name].filter(Boolean).join(' · ');
  }

  function behaviour(obs: Observation) {
    return [
      obs.countingMethodId !== DEFAULT_COUNTING_METHOD
        ? codeName(countingMethods, obs.countingMethodId)
        : undefined,
      codeName(allActivities, obs.activityId),
      codeName(allMethods, obs.methodId),
      codeName(allLifeStages, obs.lifeStageId),
      obs.sex === 'male' ? 'man' : obs.sex === 'female' ? 'vrouw' : undefined,
    ].filter(Boolean);
  }

  /** Leeftijd van de positie als die merkbaar ouder is dan de waarneming */
  function positionAge(obs: Observation): string | undefined {
    if (!obs.position) return undefined;
    const minutes = Math.floor((obs.observedAt - obs.position.fixedAt) / 60_000);
    return minutes >= 1 ? `positie ${minutes} min oud` : undefined;
  }

  /**
   * Regel met locatie en knoppen. Tijdens de wandeling alleen als er iets te
   * doen of op te letten is, zodat de lijst rustig blijft; bij de review altijd.
   */
  function showActions(obs: Observation): boolean {
    return (
      session.status === 'ended' ||
      obs.uncertain ||
      !obs.position ||
      obs.position.accuracy > 50 ||
      positionAge(obs) !== undefined
    );
  }

  /** Van einde uitspraak tot verwerkt, inclusief de tijd in de wachtrij */
  function duration(u: Utterance): string | undefined {
    if (!u.metrics) return undefined;
    return seconds(u.metrics.finishedAt - spokenAt(u));
  }

  /** De opname die nu geladen is; er speelt er hooguit één tegelijk */
  let player: { id: string; audio: HTMLAudioElement; url: string } | undefined;
  /** Uitspraak waarvan de opname nu speelt, voor ▶ of ⏸ op de knop */
  let playingId = $state<string>();
  // Met U+FE0E als tekst tonen, niet als gekleurde emoji (Android)
  const PLAY = '▶\uFE0E';
  const PAUSE = '⏸\uFE0E';

  /** Speelt de opname af, om te horen wat er gezegd werd; nog eens tikken pauzeert. */
  function togglePlay(u: Utterance) {
    if (player?.id === u.id) {
      if (player.audio.paused) player.audio.play();
      else player.audio.pause();
      return;
    }
    stopPlayer();
    const url = URL.createObjectURL(audioBlob(u.audio!));
    const audio = new Audio(url);
    audio.onplay = () => (playingId = u.id);
    audio.onpause = () => {
      if (playingId === u.id) playingId = undefined;
    };
    // Afgelopen: volgende tik begint weer vooraan
    audio.onended = stopPlayer;
    player = { id: u.id, audio, url };
    audio.play();
  }

  function stopPlayer() {
    if (!player) return;
    player.audio.pause();
    URL.revokeObjectURL(player.url);
    player = undefined;
    playingId = undefined;
  }

  // Stoppen bij het verlaten van de wandeling
  $effect(() => stopPlayer);

  function seconds(ms: number): string {
    return `${(ms / 1000).toLocaleString('nl-NL', { maximumFractionDigits: 1 })} s`;
  }

  function statusLabel(u: Utterance): string {
    if (u.kind === 'dev_note') return 'feedback';
    if (u.undone) return 'teruggedraaid';
    switch (u.status) {
      case 'pending':
        return 'in wachtrij';
      case 'processing':
        return u.transcript === undefined && u.audio ? 'verstaan…' : 'bezig…';
      case 'failed':
        return 'fout';
      case 'done':
        if (u.result === 'ignored') return 'niet begrepen';
        return u.result === 'uncertain' ? 'onzeker' : 'verwerkt';
    }
  }
</script>

{#if queued}
  <p class="queue">
    {queued === 1 ? '1 uitspraak' : `${queued} uitspraken`} in de wachtrij (zie Uitspraken)
  </p>
{/if}

<section class="card">
  <div class="card-head">
    <h2>Waarnemingen</h2>
    {#if $observations?.length}
      <span class="muted summary">
        {speciesCount === 1 ? '1 soort' : `${speciesCount} soorten`} ·
        {$observations.length === 1 ? '1 waarneming' : `${$observations.length} waarnemingen`}
      </span>
    {/if}
  </div>
  {#if uncertainCount > 0 || onlyUncertain}
    <div class="filters">
      <button
        class="chip"
        class:on={onlyUncertain}
        aria-pressed={onlyUncertain}
        onclick={() => (onlyUncertain = !onlyUncertain)}
      >
        Alleen onzeker ({uncertainCount})
      </button>
    </div>
  {/if}
  {#if shown.length}
    <ul class="obs-list">
      {#each shown as obs (obs.id)}
        {@const source = utteranceById.get(obs.utteranceId)}
        {@const species = getSpecies(obs.speciesId)}
        <li
          id="obs-{obs.id}"
          class:uncertain={obs.uncertain}
          class:skipped={obs.skipExport}
          class:flash={flashing.includes(obs.id)}
        >
          {#if editing === obs.id}
            <ObservationEditor observation={obs} utterance={source} onclose={closeEditor} />
          {:else}
            <button
              class="row"
              onclick={() => openEditor(obs.id)}
              aria-label="Waarneming aanpassen"
            >
              <RarityMark rarity={species?.rarity ?? 0} />
              <span class="main">
                <span class="name">
                  {species?.name}
                  {#if obs.status === 'reviewed'}
                    <span class="reviewed" title="Nagelopen">✓</span>
                  {/if}
                </span>
                {#if details(obs)}
                  <span class="details">{details(obs)}</span>
                {/if}
                {#if obs.uncertain}
                  <span class="reason"
                    >Onzeker{obs.uncertainReason ? `: ${obs.uncertainReason}` : ''}</span
                  >
                {/if}
                {#if obs.privateNote}
                  <span class="note">Notitie: {obs.privateNote}</span>
                {/if}
                {#if obs.remarks}
                  <span class="remarks">“{obs.remarks}”</span>
                {/if}
              </span>
              <span class="side">
                <span class="count">{obs.count}</span>
                <span class="time">{timeFormat.format(obs.observedAt)}</span>
              </span>
            </button>
            {#if showActions(obs)}
              <div class="actions">
                {#if obs.position && onshowonmap}
                  <button
                    class="to-map"
                    onclick={() => onshowonmap(obs.id)}
                    aria-label="Op de kaart laten zien"
                    >±{Math.round(obs.position.accuracy)} m</button
                  >
                {:else if obs.position}
                  <a
                    href={mapsUrl(obs.position.lat, obs.position.lon)}
                    target="_blank"
                    rel="noopener">±{Math.round(obs.position.accuracy)} m</a
                  >
                {/if}
                {#if obs.position}
                  {#if positionAge(obs)}
                    <span class="reason">{positionAge(obs)}</span>
                  {/if}
                {:else}
                  <span class="reason">geen locatie</span>
                {/if}
                <span class="end">
                  {#if obs.uncertain}
                    <button class="small discard" onclick={() => deleteObservation(obs.id)}
                      >Weg</button
                    >
                    <button class="small confirm" onclick={() => confirmObservation(obs.id)}
                      >Klopt</button
                    >
                  {/if}
                  <!-- Exporteren kan alleen bij een afgelopen wandeling -->
                  {#if session.status === 'ended'}
                    <label class="export">
                      <input
                        type="checkbox"
                        checked={!obs.skipExport}
                        onchange={(event) => setSkipExport(obs.id, !event.currentTarget.checked)}
                      />
                      Exporteren
                    </label>
                  {/if}
                </span>
              </div>
            {/if}
          {/if}
        </li>
      {/each}
    </ul>
  {:else if onlyUncertain}
    <p class="empty">Geen onzekere waarnemingen meer.</p>
  {:else}
    <p class="empty">Nog niets waargenomen. Druk op Inspreken en zeg wat je ziet of hoort.</p>
  {/if}
</section>

{#if $deleted?.length}
  <details class="card fold">
    <summary>Verwijderd ({$deleted.length})</summary>
    <ul class="plain">
      {#each $deleted as obs (obs.id)}
        <li class="deleted">
          <div>
            <strong>{obs.count} × {getSpecies(obs.speciesId)?.name}</strong>
            <span class="muted">{timeFormat.format(obs.observedAt)}</span>
            <div class="muted">{details(obs)}</div>
            <div class="muted">verwijderd {deletedByLabel[obs.deletedBy]}</div>
          </div>
          <button class="small" onclick={() => restoreObservation(obs.id)}>Terugzetten</button>
        </li>
      {/each}
    </ul>
  </details>
{/if}

{#if $utterances?.length}
  <!-- Vooral voor de ontwikkelfase; open als er iets misging of nog wacht -->
  <details class="card fold" open={failed > 0 || queued > 0}>
    <summary>Uitspraken ({$utterances.length}){failed ? ` · ${failed} fout` : ''}</summary>
    <ul class="plain">
      {#each $utterances as u (u.id)}
        <li class="utterance">
          <div>
            {#if u.audio}
              <button
                class="play"
                onclick={() => togglePlay(u)}
                aria-label={playingId === u.id ? 'Opname pauzeren' : 'Opname afspelen'}
                >{playingId === u.id ? PAUSE : PLAY}</button
              >
            {/if}
            {#if u.transcript !== undefined}
              “{u.transcript}”
            {:else}
              <span class="muted">Opname van {seconds(u.audioDurationMs ?? 0)}</span>
            {/if}
            <span class="status {u.status} {u.result}">{statusLabel(u)}</span>
            {#if duration(u)}
              <span class="status"
                >· {duration(u)}{u.metrics?.wasHidden ? ' (app op achtergrond)' : ''}</span
              >
            {/if}
          </div>
          {#if u.error}
            <div class="reason">{u.error}</div>
          {/if}
          {#if u.status === 'failed'}
            <button class="small" onclick={() => retry(u.id)}>Opnieuw</button>
          {/if}
        </li>
      {/each}
    </ul>
  </details>
{/if}

<style>
  .summary {
    font-size: 0.85rem;
    white-space: nowrap;
  }

  .filters {
    padding: 0.6rem 1rem;
    border-bottom: 1px solid var(--border);
  }

  .chip {
    padding: 0.3rem 0.8rem;
    border: 1px solid var(--amber);
    border-radius: 2rem;
    font: inherit;
    font-size: 0.85rem;
    color: var(--amber);
    background: transparent;
  }

  .chip.on {
    color: white;
    background: var(--amber);
  }

  .queue {
    margin: 1rem 0 0;
    padding: 0.5rem 0.9rem;
    border-radius: var(--radius);
    font-size: 1rem;
    color: var(--amber);
    background: var(--amber-soft);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .obs-list > li + li,
  .plain > li + li {
    border-top: 1px solid var(--border);
  }

  .obs-list > li {
    padding: 0.7rem 1rem;
  }

  .obs-list > li.uncertain {
    background: var(--amber-soft);
    box-shadow: inset 3px 0 0 var(--amber);
  }

  button.row {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    width: 100%;
    margin: 0;
    padding: 0;
    border: none;
    font: inherit;
    text-align: left;
    color: inherit;
    background: none;
  }

  /* Teken op de hoogte van de eerste regel */
  button.row > :global(.mark) {
    margin-top: 0.4rem;
  }

  .main {
    display: grid;
    flex: 1;
    min-width: 0;
  }

  .name {
    font-size: 1.05rem;
    font-weight: 600;
  }

  .reviewed {
    font-weight: 400;
    color: var(--brand);
  }

  .details,
  .note {
    font-size: 0.9rem;
    color: var(--muted);
  }

  .side {
    display: grid;
    justify-items: end;
    flex: none;
  }

  .count {
    font-size: 1.15rem;
    font-weight: 700;
    line-height: 1.35;
    font-variant-numeric: tabular-nums;
  }

  .time {
    font-size: 0.8rem;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 1.75rem;
    margin-left: 1.5rem;
    font-size: 0.8rem;
    color: var(--muted);
  }

  .actions a,
  .actions .to-map {
    color: inherit;
    text-decoration: underline dotted;
  }

  .actions .to-map {
    padding: 0;
    border: none;
    font: inherit;
    background: none;
  }

  /* Na een tik op de kaart: even oplichten */
  .obs-list > li.flash {
    animation: flash 2.5s ease-out;
  }

  @keyframes flash {
    0%,
    40% {
      background-color: color-mix(in srgb, var(--brand) 22%, transparent);
    }
  }

  .end {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: auto;
  }

  /* Weg, Klopt, Opnieuw: ook tijdens de wandeling, dus 48 px hoog (handschoenen) */
  button.small {
    box-sizing: border-box;
    min-height: 3rem;
    padding: 0.3rem 1rem;
    border: none;
    border-radius: 2rem;
    font: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    color: white;
    background: var(--brand);
  }

  button.discard {
    color: var(--red);
    background: transparent;
    box-shadow: inset 0 0 0 1.5px var(--red);
  }

  .export {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.85rem;
    color: var(--fg);
  }

  li.skipped .row {
    opacity: 0.5;
  }

  .empty {
    margin: 0;
    padding: 1.25rem 1rem;
    color: var(--muted);
  }

  .fold summary {
    padding: 0.75rem 1rem;
    font-weight: 600;
    cursor: pointer;
  }

  .fold[open] summary {
    border-bottom: 1px solid var(--border);
  }

  .plain > li {
    padding: 0.6rem 1rem;
  }

  li.deleted {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    justify-content: space-between;
  }

  li.deleted strong {
    opacity: 0.6;
  }

  li.utterance button.small {
    margin-top: 0.4rem;
  }

  button.play {
    margin: 0 0.25rem 0 0;
    padding: 0 0.5rem;
    border: none;
    border-radius: 0.4rem;
    font-size: 0.8rem;
    color: white;
    background: var(--brand);
  }

  .reason {
    color: var(--amber);
    font-size: 0.9rem;
  }

  .remarks {
    font-size: 0.9rem;
    font-style: italic;
  }

  .status {
    font-size: 0.8rem;
    color: var(--muted);
    white-space: nowrap;
  }

  .status.failed,
  .status.ignored {
    color: var(--red);
  }

  .status.note {
    color: var(--green);
  }

  .status.uncertain {
    color: var(--amber);
  }
</style>
