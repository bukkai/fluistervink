<script lang="ts">
  import { liveQuery } from 'dexie';
  import type { Observation, Session, Utterance } from './db';
  import { fillMissingAreas } from './area';
  import { mapsUrl } from './devNotes';
  import ObservationEditor from './ObservationEditor.svelte';
  import {
    deleteObservation,
    editObservation,
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
    activities,
    codeName,
    countingMethods,
    getSpecies,
    lifeStages,
    methods,
  } from './vocab';

  // Waarnemingen en uitspraken van één wandeling; gebruikt voor de lopende
  // wandeling en voor eerdere wandelingen.

  let { session }: { session: Session } = $props();

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

  let utteranceById = $derived(new Map(($utterances ?? []).map((u) => [u.id, u])));

  /** De waarneming die nu bewerkt wordt (één tegelijk) */
  let editing = $state<string>();

  let onlyUncertain = $state(false);
  let uncertainCount = $derived($observations?.filter((obs) => obs.uncertain).length ?? 0);
  let shown = $derived(
    ($observations ?? []).filter((obs) => !onlyUncertain || obs.uncertain || obs.id === editing),
  );

  /** Aantal soorten, zonder verzamelsoorten ("Eend onbekend") */
  let speciesCount = $derived(
    new Set(
      ($observations ?? [])
        .filter((obs) => getSpecies(obs.speciesId)?.type !== 'M')
        .map((obs) => obs.speciesId),
    ).size,
  );

  const deletedByLabel = { hand: 'met de hand', voice: 'met de stem', undo: 'ongedaan gemaakt' };

  /** Onzekere waarneming nagelopen en goed bevonden */
  function confirmObservation(obs: Observation) {
    editObservation(obs.id, { uncertain: false, uncertainReason: undefined });
  }

  const timeFormat = new Intl.DateTimeFormat('nl-NL', { timeStyle: 'short' });

  function details(obs: Observation) {
    return [
      obs.countingMethodId !== DEFAULT_COUNTING_METHOD
        ? codeName(countingMethods, obs.countingMethodId)
        : undefined,
      codeName(activities, obs.activityId),
      codeName(methods, obs.methodId),
      codeName(lifeStages, obs.lifeStageId),
      obs.sex === 'male' ? 'man' : obs.sex === 'female' ? 'vrouw' : undefined,
    ]
      .filter(Boolean)
      .join(', ');
  }

  /** Leeftijd van de positie als die merkbaar ouder is dan de waarneming */
  function positionAge(obs: Observation): string | undefined {
    if (!obs.position) return undefined;
    const minutes = Math.floor((obs.observedAt - obs.position.fixedAt) / 60_000);
    return minutes >= 1 ? `positie ${minutes} min oud` : undefined;
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
    const url = URL.createObjectURL(u.audio!);
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
    if (u.kind === 'dev_note') return 'dev note';
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
  <p class="muted">
    {queued === 1 ? '1 uitspraak' : `${queued} uitspraken`} in de wachtrij (zie Uitspraken)
  </p>
{/if}

<h2>Waarnemingen</h2>
{#if $observations?.length}
  <p class="muted summary">
    {speciesCount === 1 ? '1 soort' : `${speciesCount} soorten`} ·
    {$observations.length === 1 ? '1 waarneming' : `${$observations.length} waarnemingen`}
  </p>
{/if}
{#if uncertainCount > 0 || onlyUncertain}
  <label class="filter">
    <input type="checkbox" bind:checked={onlyUncertain} />
    Alleen onzeker ({uncertainCount})
  </label>
{/if}
{#if shown.length}
  <ul>
    {#each shown as obs (obs.id)}
      {@const source = utteranceById.get(obs.utteranceId)}
      <li class:uncertain={obs.uncertain} class:skipped={obs.skipExport}>
        {#if editing === obs.id}
          <ObservationEditor observation={obs} utterance={source} onclose={() => (editing = undefined)} />
        {:else}
          <button class="row" onclick={() => (editing = obs.id)} aria-label="Waarneming aanpassen">
            <div>
              <strong>{obs.count} × {getSpecies(obs.speciesId)?.name}</strong>
              <span class="muted">{timeFormat.format(obs.observedAt)}</span>
              {#if obs.status === 'reviewed'}
                <span class="muted" title="Nagelopen">✓</span>
              {/if}
            </div>
            <div class="muted">{details(obs)}</div>
            {#if obs.area}
              <div class="muted">{obs.area.name}</div>
            {/if}
            {#if obs.uncertain}
              <div class="reason">Onzeker{obs.uncertainReason ? `: ${obs.uncertainReason}` : ''}</div>
            {/if}
            {#if obs.privateNote}
              <div class="note">Notitie: {obs.privateNote}</div>
            {/if}
            {#if obs.remarks}
              <div class="remarks">“{obs.remarks}”</div>
            {/if}
          </button>
          <div class="actions">
            {#if obs.position}
              <a
                class="muted"
                href={mapsUrl(obs.position.lat, obs.position.lon)}
                target="_blank"
                rel="noopener">±{Math.round(obs.position.accuracy)} m</a
              >
              {#if positionAge(obs)}
                <span class="reason">{positionAge(obs)}</span>
              {/if}
            {:else}
              <span class="reason">geen locatie</span>
            {/if}
            <span class="end">
              {#if obs.uncertain}
                <button class="discard" onclick={() => deleteObservation(obs.id)}>Weg</button>
                <button class="confirm" onclick={() => confirmObservation(obs)}>Klopt</button>
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
      </li>
    {/each}
  </ul>
{:else if onlyUncertain}
  <p class="muted">Geen onzekere waarnemingen meer.</p>
{:else}
  <p class="muted">Nog niets waargenomen.</p>
{/if}

{#if $deleted?.length}
  <details class="deleted">
    <summary>Verwijderd ({$deleted.length})</summary>
    <ul>
      {#each $deleted as obs (obs.id)}
        <li>
          <div class="actions">
            <div>
              <strong>{obs.count} × {getSpecies(obs.speciesId)?.name}</strong>
              <span class="muted">{timeFormat.format(obs.observedAt)}</span>
              <div class="muted">{details(obs)}</div>
              <div class="muted">verwijderd {deletedByLabel[obs.deletedBy]}</div>
            </div>
            <span class="end">
              <button onclick={() => restoreObservation(obs.id)}>Terugzetten</button>
            </span>
          </div>
        </li>
      {/each}
    </ul>
  </details>
{/if}

{#if $utterances?.length}
  <h2>Uitspraken ({$utterances.length})</h2>
  <ul>
    {#each $utterances as u (u.id)}
      <li>
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
            <span class="status">· {duration(u)}{u.metrics?.wasHidden ? ' (app op achtergrond)' : ''}</span>
          {/if}
        </div>
        {#if u.error}
          <div class="reason">{u.error}</div>
        {/if}
        {#if u.status === 'failed'}
          <button onclick={() => retry(u.id)}>Opnieuw</button>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  button {
    padding: 0.25rem 0.75rem;
    margin-top: 0.25rem;
    border: none;
    border-radius: 0.5rem;
    font: inherit;
    background: var(--green);
    color: white;
  }

  button.play {
    margin: 0 0.25rem 0 0;
    padding: 0 0.5rem;
    font-size: 0.8rem;
  }

  ul {
    padding: 0;
    list-style: none;
  }

  li {
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border);
  }

  button.row {
    display: block;
    width: 100%;
    margin: 0;
    padding: 0;
    background: none;
    color: inherit;
    text-align: left;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  .actions a {
    text-decoration: underline dotted;
  }

  .end {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: auto;
  }

  button.confirm,
  button.discard {
    margin: 0;
  }

  button.discard {
    background: var(--red);
  }

  .summary {
    margin-top: -0.5rem;
  }

  .deleted {
    margin-top: 1rem;
  }

  .deleted summary {
    color: var(--muted);
  }

  .deleted li strong {
    opacity: 0.6;
  }

  .export {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  li.skipped .row {
    opacity: 0.5;
  }

  .filter {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  li.uncertain {
    border-left: 3px solid var(--amber);
    padding-left: 0.5rem;
  }

  .muted {
    color: var(--muted);
  }

  .reason {
    color: var(--amber);
    font-size: 0.9rem;
  }

  .remarks {
    font-size: 0.9rem;
    font-style: italic;
  }

  .note {
    font-size: 0.9rem;
    color: var(--muted);
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
