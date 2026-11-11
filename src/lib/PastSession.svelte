<script lang="ts">
  import { liveQuery } from 'dexie';
  import type { Session } from './db';
  import { renameSession } from './area';
  import { countSpecies, listObservations } from './observations';
  import { deleteSessions, formatDuration, resumeSession } from './sessions';
  import { confirmDeleteText, countRecordings, deleteRecordings } from './recordings';
  import ObservationMap from './ObservationMap.svelte';
  import SessionLog from './SessionLog.svelte';
  import SessionSummary from './SessionSummary.svelte';
  import { preferenceOn } from './preferences';
  import UncertainReview from './UncertainReview.svelte';
  import { IMPORT_URL, approveSession, exportForWaarneming, markReady } from './waarnemingExport';

  // Een afgelopen sessie nalopen en klaarzetten voor waarneming.nl (de
  // export zelf gaat voor alle klaarstaande sessies tegelijk, op het
  // scherm Sessies). Hier kom je ook meteen na "Stop sessie".

  /**
   * `resumable`: de meest recente sessie, en er loopt geen andere.
   * `justSaved`: net gestopt; dan een bevestiging bovenaan.
   */
  let {
    session,
    resumable,
    justSaved = false,
  }: { session: Session; resumable: boolean; justSaved?: boolean } = $props();

  let observations = $derived(liveQuery(() => listObservations(session.id)));
  let uncertainCount = $derived($observations?.filter((obs) => obs.uncertain).length ?? 0);

  // Kaart en lijst aan elkaar gekoppeld: een nieuw object bij elke tik, zodat
  // ook nog eens dezelfde waarneming kiezen opnieuw werkt.
  let mapFocus = $state<{ id: string }>();
  let listFocus = $state<{ ids: string[] }>();

  async function resume() {
    if (!confirm('Deze sessie voortzetten?')) return;
    if (await resumeSession(session.id)) location.hash = '';
  }

  async function remove() {
    const warning = session.exportedAt ? '' : '\n\nDeze sessie is nog niet geëxporteerd.';
    if (!confirm(`Sessie voorgoed verwijderen, met alle waarnemingen en opnames?${warning}`))
      return;
    await deleteSessions([session.id]);
    location.hash = 'sessies';
  }

  // Alleen de opnames wissen; de sessie, de tekst en de waarnemingen blijven
  let recordings = $derived(liveQuery(() => countRecordings(session.id)));

  async function removeRecordings() {
    const current = await countRecordings(session.id);
    if (!current.count || !confirm(confirmDeleteText(current, 'van deze sessie'))) return;
    await deleteRecordings(session.id);
  }

  async function rename() {
    const name = prompt(
      'Naam van de sessie (leeg laten = automatisch, uit het gebied met de meeste waarnemingen):',
      session.place?.name ?? '',
    );
    if (name !== null) await renameSession(session.id, name);
  }

  /** Uitkomst van de laatste export, om onder de knop te tonen */
  let exportResult = $state<string>();

  /** "Alles klopt": de rest geldt als nagelopen (ook de onzekere), en de sessie staat klaar */
  async function ready() {
    if (
      uncertainCount > 0 &&
      !confirm(
        `Nog ${uncertainCount === 1 ? '1 onzekere waarneming' : `${uncertainCount} onzekere waarnemingen`}. ` +
          (uncertainCount === 1
            ? 'Klopt die ook? Dan wordt hij zeker.'
            : 'Kloppen die ook? Dan worden ze zeker.'),
      )
    )
      return;
    await approveSession(session.id);
  }

  async function exportOnlyThis() {
    exportResult = (await exportForWaarneming([session])) ?? exportResult;
  }

  const dateFormat = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'full' });
  const timeFormat = new Intl.DateTimeFormat('nl-NL', { timeStyle: 'short' });
</script>

<a class="back" href="#sessies">Sessies</a>

{#if justSaved}
  <div class="saved" role="status">
    <strong>✓ Sessie opgeslagen</strong>
    <p>
      Alles staat veilig op je telefoon. Loop de waarnemingen na en zet de sessie klaar voor
      waarneming.nl.
    </p>
  </div>
{/if}

<header>
  <div class="title">
    <h2 class="page-title">{session.place?.name ?? 'Vogelsessie'}</h2>
    <button class="rename" onclick={rename} aria-label="Naam wijzigen" title="Naam wijzigen">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </div>
  <p class="muted">
    {dateFormat.format(session.startedAt)},
    {timeFormat.format(session.startedAt)}–{session.endedAt
      ? timeFormat.format(session.endedAt)
      : '?'}
  </p>
</header>

{#if $observations}
  <dl class="stats">
    <div>
      <dt>Duur</dt>
      <dd>{formatDuration((session.endedAt ?? session.startedAt) - session.startedAt)}</dd>
    </div>
    <div>
      <dt>Soorten</dt>
      <dd>{countSpecies($observations)}</dd>
    </div>
    <div>
      <dt>Waarnemingen</dt>
      <dd>
        {$observations.length}
        {#if uncertainCount > 0}<small>{uncertainCount} onzeker</small>{/if}
      </dd>
    </div>
  </dl>
{/if}

{#if preferenceOn('samenvatting')}
  <SessionSummary {session} />
{/if}

{#if !session.exportedAt}
  <UncertainReview {session} />
{/if}

<ObservationMap {session} focus={mapFocus} onselect={(ids) => (listFocus = { ids })} />

<SessionLog {session} focus={listFocus} onshowonmap={(id) => (mapFocus = { id })} />

<section class="card export">
  <div class="card-head">
    <h2>Klaar met nalopen?</h2>
    {#if session.exportedAt && !exportResult}
      <span class="badge">geëxporteerd</span>
    {:else if session.readyAt && !exportResult}
      <span class="badge">klaar</span>
    {/if}
  </div>
  <div class="card-body">
    {#if exportResult}
      <p>{exportResult}</p>
    {:else if session.exportedAt}
      <p class="muted">
        Geëxporteerd op {dateFormat.format(session.exportedAt)}
        om {timeFormat.format(session.exportedAt)}.
      </p>
    {:else if session.readyAt}
      <p class="first">
        Deze sessie staat klaar. Exporteer alle klaarstaande sessies in één keer bij Sessies.
      </p>
      <div class="actions">
        <a class="btn block" href="#sessies">Naar Sessies</a>
        <button class="btn secondary block" onclick={() => markReady(session.id, false)}
          >Toch nog niet klaar</button
        >
      </div>
    {:else}
      {#if uncertainCount > 0}
        <p class="warning">
          Nog {uncertainCount === 1
            ? '1 onzekere waarneming'
            : `${uncertainCount} onzekere waarnemingen`}. Loop ze bovenaan na, of tik erop in de
          lijst.
        </p>
      {/if}
      <button class="btn block large" onclick={ready}>Alles klopt, klaar voor waarneming.nl</button>
      <p class="muted">
        De waarnemingen gelden dan als nagelopen. Klaargezette sessies exporteer je later in één
        bestand, bij Sessies.
      </p>
    {/if}
    <div class="actions only-this">
      <button class="btn secondary block" onclick={exportOnlyThis}
        >Alleen deze sessie exporteren</button
      >
    </div>
    <p class="muted">
      Importeer het bestand bij
      <a href={IMPORT_URL} target="_blank" rel="noopener">waarneming.nl</a>, met de site in het
      Nederlands.
    </p>
  </div>
</section>

<!-- Knoppen in plaats van linkjes: ook met dikke vingers of handschoenen te raken -->
<div class="footer actions">
  {#if resumable}
    <button class="btn secondary block" onclick={resume}>Per ongeluk gestopt? Voortzetten</button>
  {/if}
  {#if $recordings?.count}
    <button class="btn secondary block danger-text" onclick={removeRecordings}
      >Alleen de opnames wissen</button
    >
  {/if}
  <button class="btn secondary block danger-text" onclick={remove}>Sessie verwijderen</button>
</div>

<style>
  a:not(.btn) {
    color: var(--brand-strong);
  }

  .saved {
    margin-top: 0.75rem;
    padding: 0.85rem 1rem;
    border-radius: var(--radius);
    background: var(--success);
    color: white;
  }

  .saved strong {
    font-size: 1.1rem;
  }

  .saved p {
    margin: 0.25rem 0 0;
    font-size: 0.9rem;
  }

  header {
    margin-top: 0.5rem;
  }

  header .page-title {
    margin-bottom: 0.15rem;
  }

  header p {
    margin: 0;
  }

  .title {
    display: flex;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .title .page-title {
    flex: 1;
    min-width: 0;
  }

  /* Potloodje: 48 px tikvlak, ook met dikke vingers */
  .rename {
    display: grid;
    flex: none;
    place-items: center;
    width: 3rem;
    height: 3rem;
    margin: -0.4rem -0.6rem 0 0;
    padding: 0;
    border: none;
    border-radius: 50%;
    color: var(--brand-strong);
    background: none;
    cursor: pointer;
  }

  .rename:active {
    background: color-mix(in srgb, var(--brand) 12%, transparent);
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
    margin: 1rem 0;
  }

  .stats div {
    padding: 0.6rem 0.65rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
  }

  .stats dt {
    overflow: hidden;
    font-size: 0.75rem;
    text-overflow: ellipsis;
    font-weight: 600;
    color: var(--muted);
  }

  .stats dd {
    margin: 0.1rem 0 0;
    font-size: 1.35rem;
    font-weight: 700;
    line-height: 1.2;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .stats small {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--amber);
  }

  .export p {
    margin: 0.75rem 0 0;
    font-size: 0.9rem;
  }

  .export .warning {
    margin: 0 0 0.75rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.6rem;
    color: var(--amber);
    background: var(--amber-soft);
  }

  .badge {
    padding: 0 0.55rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--brand-strong);
    background: color-mix(in srgb, var(--brand) 12%, transparent);
  }

  .actions {
    display: grid;
    gap: 0.5rem;
  }

  .actions .btn {
    min-height: 3rem;
  }

  .export .first {
    margin-top: 0;
    margin-bottom: 0.75rem;
  }

  .only-this {
    margin-top: 1rem;
  }

  .export .only-this + p {
    margin-top: 0.4rem;
  }

  .footer {
    margin: 1.5rem 0 1rem;
  }

  .danger-text {
    color: var(--red);
  }
</style>
