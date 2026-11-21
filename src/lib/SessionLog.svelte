<script lang="ts">
  import { LOCALE, t } from './i18n';
  import { timeFormat } from './format';
  import { liveQuery } from 'dexie';
  import { tick, untrack } from 'svelte';
  import { type Observation, type Session, type Utterance } from './db';
  import { player } from './player.svelte';
  import { fillMissingAreas } from './area';
  import { mapsUrl } from './devNotes';
  import ObservationEditor from './ObservationEditor.svelte';
  import RarityMark from './RarityMark.svelte';
  import {
    confirmObservation,
    countSpecies,
    deleteObservation,
    dismissUtterance,
    forgetRescue,
    listDeleted,
    listObservations,
    listUtterances,
    notUnderstood,
    rescueUtterance,
    restoreObservation,
    setSkipExport,
    spokenAt,
    voiceOriginals,
    type VoiceOriginal,
  } from './observations';
  import { LONG_WAIT_MS, retry, retryNow } from './queue';
  import { trektelBacklog } from './trektel';
  import {
    DEFAULT_COUNTING_METHOD,
    activityLabel,
    countingMethodLabel,
    getSpecies,
    lifeStageLabel,
    methodLabel,
    speciesLabel,
  } from './vocab';

  // Waarnemingen en uitspraken van één sessie; gebruikt voor de lopende
  // sessie en voor eerdere sessies.

  /**
   * Bij de review staat er een kaart boven de lijst:
   * `focus`: waarnemingen die op de kaart zijn aangetikt, om op te laten lichten.
   * `onshowonmap`: een waarneming op de kaart laten zien (in plaats van de kaarten-app).
   * `editing`: de waarneming die nu bewerkt wordt (één tegelijk), te volgen
   * met `bind:`, zodat de lopende sessie de inspreekknop dan klein maakt.
   */
  let {
    session,
    focus,
    onshowonmap,
    editing = $bindable(),
  }: {
    session: Session;
    focus?: { ids: string[] };
    onshowonmap?: (id: string) => void;
    editing?: string;
  } = $props();

  // Alleen het id: het sessie-object zelf verandert tijdens een sessie bij elke
  // GPS-meting (afgelegde afstand), en dan zou alles hieronder elke seconde
  // opnieuw lopen.
  const sessionId = $derived(session.id);

  // Opnieuw opvragen als de sessie wisselt; liveQuery volgt daarna zelf de database
  let observations = $derived(liveQuery(() => listObservations(sessionId)));
  let utterances = $derived(liveQuery(() => listUtterances(sessionId)));
  let deleted = $derived(liveQuery(() => listDeleted(sessionId)));

  // Gebiedsnamen die nog ontbreken (geen verbinding, oudere sessies) alsnog opzoeken
  $effect(() => {
    fillMissingAreas(sessionId);
  });

  let queued = $derived(
    $utterances?.filter((u) => u.status === 'pending' || u.status === 'processing').length ?? 0,
  );

  // Wacht er een uitspraak op bereik? Dan
  // geen foutmelding, maar een rustige regel: het is geen fout.
  let waitingSince = $derived(
    Math.min(
      ...($utterances ?? []).flatMap((u) =>
        u.status === 'pending' && u.waitingSince ? [u.waitingSince] : [],
      ),
    ),
  );
  let waiting = $derived(Number.isFinite(waitingSince));
  // Al lang (trektelling: de stukken stapelen zich op). Opnieuw bekeken bij
  // elke nieuwe uitspraak, dus bij een trektelling elke minuut.
  let longWait = $derived(waiting && Date.now() - waitingSince >= LONG_WAIT_MS);

  // Trektelling met het scherm uit: alles komt bij het ontgrendelen tegelijk binnen
  let backlog = $derived(trektelBacklog($utterances ?? [], Date.now()));

  let failed = $derived($utterances?.filter((u) => u.status === 'failed').length ?? 0);

  /** "Probeer opnieuw" loopt: knop uit en het pictogram draait */
  let retrying = $state(false);

  async function tryAgain() {
    retrying = true;
    try {
      // Even laten draaien, ook als het meteen weer mislukt: dan zie je dat er geprobeerd is
      await Promise.all([retryNow(), new Promise((resolve) => setTimeout(resolve, 600))]);
    } finally {
      retrying = false;
    }
  }

  let utteranceById = $derived(new Map(($utterances ?? []).map((u) => [u.id, u])));

  // Het formulier krijgt een eigen stap in de geschiedenis (zelfde URL), zodat
  // de terugknop van Android het formulier sluit in plaats van de app.
  function openEditor(id: string) {
    // Staat er nog een stap van vóór een herstart van de app, dan die hergebruiken
    if (editing === undefined && !history.state?.editor) history.pushState({ editor: true }, '');
    editing = id;
  }

  /** Opslaan, Annuleren of Verwijderen: de eigen stap weer uit de geschiedenis */
  function closeEditor(saved?: boolean) {
    if (!saved) dropRescue();
    rescuing = undefined;
    if (history.state?.editor) history.back();
    else editing = undefined;
  }

  // Niet begrepen uitspraken (alleen bij het nalopen): terugluisteren, er een
  // waarneming van maken of wegzetten. Niet meer na de export: dan is de sessie af.
  let unclear = $derived(
    session.status === 'ended' && !session.exportedAt ? notUnderstood($utterances ?? []) : [],
  );
  /** Waarneming net gemaakt van een niet begrepen uitspraak; annuleren haalt hem weg */
  let rescuing = $state<string>();

  async function rescue(utteranceId: string) {
    const id = await rescueUtterance(utteranceId);
    if (!id) return;
    onlyUncertain = false;
    rescuing = id;
    openEditor(id);
    await tick();
    document.getElementById(`obs-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function dropRescue() {
    if (rescuing) forgetRescue(rescuing);
  }

  $effect(() => {
    const onPopState = () => {
      if (history.state?.editor) return;
      // Terugknop: telt als Annuleren
      dropRescue();
      rescuing = undefined;
      editing = undefined;
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

  function details(obs: Observation) {
    return [...behaviour(obs), obs.area?.name].filter(Boolean).join(' · ');
  }

  // Met de stem aangepast ("nee, wulpen"): opvallen tot hij nagelopen is, want
  // een correctie kan op de verkeerde waarneming landen
  let voiceChanged = $derived(voiceOriginals($utterances ?? [], $observations ?? []));

  /** "3 × Holenduif", met het gedrag dat toen anders was */
  function wasText(obs: Observation, original: VoiceOriginal): string {
    const was = { ...obs, ...original };
    const now = behaviour(obs);
    const extra = behaviour(was).filter((label) => !now.includes(label));
    return [`${was.count} × ${speciesLabel(was.speciesId)}`, ...extra].join(', ');
  }

  function behaviour(obs: Observation) {
    return [
      obs.countingMethodId !== DEFAULT_COUNTING_METHOD
        ? countingMethodLabel(obs.countingMethodId)
        : undefined,
      activityLabel(obs.speciesId, obs.activityId),
      methodLabel(obs.speciesId, obs.methodId),
      lifeStageLabel(obs.speciesId, obs.lifeStageId),
      obs.sex === 'male' ? t('log.male') : obs.sex === 'female' ? t('log.female') : undefined,
    ].filter(Boolean);
  }

  /** Leeftijd van de positie als die merkbaar ouder is dan de waarneming */
  function positionAge(obs: Observation): string | undefined {
    if (!obs.position) return undefined;
    const minutes = Math.floor((obs.observedAt - obs.position.fixedAt) / 60_000);
    if (minutes >= 1) return t('log.positionOld', { m: minutes });
    // De GPS had nog geen plek; deze kwam later (`positionLater`)
    const later = Math.floor((obs.position.fixedAt - obs.observedAt) / 60_000);
    return later >= 1 ? t('log.positionLater', { m: later }) : undefined;
  }

  /**
   * Regel met locatie en knoppen. Tijdens de sessie alleen als er iets te
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

  // Stoppen bij het verlaten van de sessie
  $effect(() => player.stop);

  function seconds(ms: number): string {
    return t('log.seconds', {
      s: (ms / 1000).toLocaleString(LOCALE, { maximumFractionDigits: 1 }),
    });
  }

  function statusLabel(u: Utterance): string {
    if (u.kind === 'dev_note') return t('log.status.feedback');
    if (u.undone) return t('log.status.undone');
    switch (u.status) {
      case 'pending':
        return u.waitingSince ? t('log.status.waiting') : t('log.status.queued');
      case 'processing':
        return u.transcript === undefined && u.audio
          ? t('log.status.transcribing')
          : t('log.status.processing');
      case 'failed':
        return t('log.status.failed');
      case 'done':
        if (u.result === 'ignored') return t('log.status.ignored');
        return u.result === 'uncertain' ? t('log.status.uncertain') : t('log.status.done');
    }
  }
</script>

{#if waiting}
  <div class="queue waiting">
    <p role="status">
      {t(longWait ? 'log.waitingLong' : 'log.waiting', { n: queued })}
    </p>
    <button
      class="retry"
      class:spinning={retrying}
      onclick={tryAgain}
      disabled={retrying}
      aria-label={t('log.retry')}
      title={t('log.retry')}
    >
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path
          d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v3.7h-3.7M6 21v-3.7h3.7"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </div>
{:else if queued}
  <p class="queue">
    {backlog ? t('log.trektelBacklog', backlog) : t('log.queued', { n: queued })}
  </p>
{/if}

{#if unclear.length}
  <section class="card unclear">
    <div class="card-head">
      <h2>{t('log.notUnderstood', { n: unclear.length })}</h2>
    </div>
    <p class="hint">{t('log.notUnderstoodHint')}</p>
    <ul class="plain">
      {#each unclear as u (u.id)}
        <li>
          <div>
            {#if u.audio}
              <button
                class="play"
                onclick={() => player.toggle(u.id, u.audio!)}
                aria-label={player.label(u.id)}>{player.symbol(u.id)}</button
              >
            {/if}
            <span class="muted">{timeFormat.format(u.recordedAt)}</span>
            “{u.transcript}”
          </div>
          <div class="unclear-actions">
            <button class="btn" onclick={() => rescue(u.id)}>{t('log.rescue')}</button>
            <button class="btn secondary" onclick={() => dismissUtterance(u.id)}
              >{t('log.dismiss')}</button
            >
          </div>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<section class="card">
  <div class="card-head">
    <h2>{t('log.observations')}</h2>
    {#if $observations?.length}
      <span class="muted summary">
        {t('log.speciesCount', { n: speciesCount })} ·
        {t('log.observationCount', { n: $observations.length })}
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
        {t('log.onlyUncertain', { n: uncertainCount })}
      </button>
    </div>
  {/if}
  {#if shown.length}
    <ul class="obs-list">
      {#each shown as obs (obs.id)}
        {@const source = utteranceById.get(obs.utteranceId)}
        {@const species = getSpecies(obs.speciesId)}
        {@const original = obs.status === 'draft' ? voiceChanged.get(obs.id) : undefined}
        <li
          id="obs-{obs.id}"
          class:uncertain={obs.uncertain}
          class:skipped={obs.skipExport}
          class:flash={flashing.includes(obs.id)}
        >
          {#if editing === obs.id}
            <ObservationEditor
              observation={obs}
              utterance={source}
              onclose={closeEditor}
              reviewing={obs.id === rescuing}
              oncopy={(id) => {
                // Gekopieerd: het origineel blijft, ook als je de kopie annuleert
                rescuing = undefined;
                editing = id;
              }}
            />
          {:else}
            <button class="row" onclick={() => openEditor(obs.id)} aria-label={t('log.edit')}>
              <RarityMark rarity={species?.rarity ?? 0} />
              <span class="main">
                <span class="name">
                  {speciesLabel(obs.speciesId)}
                  {#if obs.status === 'reviewed'}
                    <span class="reviewed" title={t('log.reviewed')}>✓</span>
                  {/if}
                </span>
                {#if details(obs)}
                  <span class="details">{details(obs)}</span>
                {/if}
                {#if obs.uncertain}
                  <span class="reason"
                    >{obs.uncertainReason
                      ? t('log.uncertainBecause', { reason: obs.uncertainReason })
                      : t('log.uncertain')}</span
                  >
                {/if}
                {#if original}
                  <span class="voice"
                    >{t('log.changedByVoice', { was: wasText(obs, original) })}</span
                  >
                {/if}
                {#if obs.privateNote}
                  <span class="note">{t('log.note', { note: obs.privateNote })}</span>
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
                    aria-label={t('log.showOnMap')}>±{Math.round(obs.position.accuracy)} m</button
                  >
                {:else if obs.position}
                  <a
                    href={mapsUrl(obs.position.lat, obs.position.lon)}
                    target="_blank"
                    rel="noopener">±{Math.round(obs.position.accuracy)} m</a
                  >
                {/if}
                {#if obs.position}
                  {#if obs.placedByVoice}
                    <span class="muted">{t('log.placedByVoice')}</span>
                  {:else if obs.recordedPosition !== undefined}
                    <span class="muted">{t('log.placedByHand')}</span>
                  {:else if positionAge(obs)}
                    <span class="reason">{positionAge(obs)}</span>
                  {/if}
                {:else}
                  <span class="reason">{t('log.noLocation')}</span>
                {/if}
                <span class="end">
                  {#if obs.uncertain}
                    <button class="small discard" onclick={() => deleteObservation(obs.id)}
                      >{t('log.discard')}</button
                    >
                    <button class="small confirm" onclick={() => confirmObservation(obs.id)}
                      >{t('log.confirm')}</button
                    >
                  {/if}
                  <!-- Exporteren kan alleen bij een afgelopen sessie -->
                  {#if session.status === 'ended'}
                    <label class="export">
                      <input
                        type="checkbox"
                        checked={!obs.skipExport}
                        onchange={(event) => setSkipExport(obs.id, !event.currentTarget.checked)}
                      />
                      {t('log.export')}
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
    <p class="empty">{t('log.noUncertainLeft')}</p>
  {:else}
    <p class="empty">{t('log.empty')}</p>
  {/if}
</section>

{#if $deleted?.length}
  <details class="card fold">
    <summary>{t('log.deleted', { n: $deleted.length })}</summary>
    <ul class="plain">
      {#each $deleted as obs (obs.id)}
        <li class="deleted">
          <div>
            <strong>{obs.count} × {speciesLabel(obs.speciesId)}</strong>
            <span class="muted">{timeFormat.format(obs.observedAt)}</span>
            <div class="muted">{details(obs)}</div>
            <div class="muted">{t(`log.deletedBy.${obs.deletedBy}`)}</div>
          </div>
          <button class="small" onclick={() => restoreObservation(obs.id)}
            >{t('log.restore')}</button
          >
        </li>
      {/each}
    </ul>
  </details>
{/if}

{#if $utterances?.length}
  <!-- Vooral voor de ontwikkelfase; open als er iets misging of nog wacht -->
  <details class="card fold" open={failed > 0 || queued > 0}>
    <summary
      >{failed
        ? t('log.utterancesFailed', { n: $utterances.length, failed })
        : t('log.utterances', { n: $utterances.length })}</summary
    >
    <ul class="plain">
      {#each $utterances as u (u.id)}
        <li class="utterance">
          <div>
            {#if u.audio}
              <button
                class="play"
                onclick={() => player.toggle(u.id, u.audio!)}
                aria-label={player.label(u.id)}>{player.symbol(u.id)}</button
              >
            {/if}
            {#if u.audioDeletedAt}
              <span class="muted">{t('log.audioDeleted')}</span>
            {/if}
            {#if u.transcript !== undefined}
              “{u.transcript}”
            {:else}
              <span class="muted"
                >{t('log.recordingOf', { duration: seconds(u.audioDurationMs ?? 0) })}</span
              >
            {/if}
            <span class="status {u.status} {u.result}">{statusLabel(u)}</span>
            {#if duration(u)}
              <span class="status"
                >· {u.metrics?.wasHidden
                  ? t('log.inBackground', { duration: duration(u) ?? '' })
                  : duration(u)}</span
              >
            {/if}
          </div>
          {#if u.error}
            <div class="reason">{u.error}</div>
          {/if}
          {#if u.status === 'failed'}
            <button class="small" onclick={() => retry(u.id)}>{t('log.again')}</button>
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

  .queue.waiting {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding-right: 0.3rem;
    color: var(--fg);
    background: var(--surface);
    border: 1px solid var(--border);
  }

  .queue.waiting p {
    flex: 1;
    margin: 0;
  }

  /* Rond knopje met twee pijlen in een cirkel, groot genoeg voor een handschoen */
  .retry {
    display: grid;
    flex: none;
    place-items: center;
    width: 3rem;
    height: 3rem;
    padding: 0;
    border: none;
    border-radius: 50%;
    color: var(--brand-strong);
    background: none;
    cursor: pointer;
  }

  .retry:active {
    background: color-mix(in srgb, var(--brand) 12%, transparent);
  }

  .retry.spinning svg {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .retry.spinning svg {
      animation: none;
    }
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
    color: var(--brand-strong);
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

  /* Weg, Klopt, Opnieuw: ook tijdens de sessie, dus 48 px hoog (handschoenen) */
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

  .unclear .hint {
    margin: 0;
    padding: 0.6rem 1rem 0;
  }

  .unclear li + li {
    border-top: 1px solid var(--border);
  }

  .unclear-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
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

  .voice {
    font-size: 0.9rem;
    color: var(--brand-strong);
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
