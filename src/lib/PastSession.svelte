<script lang="ts">
  import { liveQuery } from 'dexie';
  import type { Session } from './db';
  import { download } from './export';
  import { renameSession } from './area';
  import { countSpecies, listObservations } from './observations';
  import { deleteSessions, formatDuration, resumeSession } from './sessions';
  import ObservationMap from './ObservationMap.svelte';
  import SessionLog from './SessionLog.svelte';
  import { IMPORT_URL, buildExport, markExported } from './waarnemingExport';

  // Een afgelopen wandeling nalopen en exporteren. Hier kom je ook meteen
  // na "Stop wandeling".

  /**
   * `resumable`: de meest recente wandeling, en er loopt geen andere.
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
    if (!confirm('Deze wandeling voortzetten?')) return;
    if (await resumeSession(session.id)) location.hash = '';
  }

  async function remove() {
    const warning = session.exportedAt ? '' : '\n\nDeze wandeling is nog niet geëxporteerd.';
    if (!confirm(`Wandeling voorgoed verwijderen, met alle waarnemingen en opnames?${warning}`)) return;
    await deleteSessions([session.id]);
    location.hash = 'wandelingen';
  }

  async function rename() {
    const name = prompt(
      'Naam van de wandeling (leeg laten = automatisch, uit het gebied met de meeste waarnemingen):',
      session.place?.name ?? '',
    );
    if (name !== null) await renameSession(session.id, name);
  }

  /** Uitkomst van de laatste export, om onder de knop te tonen */
  let exportResult = $state<string>();

  async function exportForWaarneming() {
    const result = await buildExport(session);
    if (result.exported.length === 0) {
      exportResult = 'Geen waarnemingen met een locatie om te exporteren.';
      return;
    }
    const uncertain = result.exported.filter((obs) => obs.uncertain).length;
    const warnings = [
      uncertain > 0 &&
        `${uncertain} ${uncertain === 1 ? 'waarneming is' : 'waarnemingen zijn'} nog onzeker ` +
          `en ${uncertain === 1 ? 'gaat' : 'gaan'} mee als "niet zeker".`,
      session.exportedAt &&
        'Deze wandeling is al eerder geëxporteerd. Waarneming.nl weigert waarnemingen ' +
          'die al zijn ingevoerd.',
    ].filter(Boolean);
    if (warnings.length && !confirm([...warnings, 'Toch exporteren?'].join('\n\n'))) return;

    download(result.csv, result.filename);
    await markExported(session, result.exported);
    exportResult = [
      `${result.exported.length} waarnemingen geëxporteerd.`,
      result.skipped.length &&
        `${result.skipped.length} zonder locatie overgeslagen; voer die met de hand in.`,
      result.excluded.length && `${result.excluded.length} uitgevinkt en niet geëxporteerd.`,
    ]
      .filter(Boolean)
      .join(' ');
  }

  const dateFormat = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'full' });
  const timeFormat = new Intl.DateTimeFormat('nl-NL', { timeStyle: 'short' });
</script>

<a class="back" href="#wandelingen">Wandelingen</a>

{#if justSaved}
  <div class="saved" role="status">
    <strong>✓ Wandeling opgeslagen</strong>
    <p>Alles staat veilig op je telefoon. Loop de waarnemingen na en exporteer ze naar waarneming.nl.</p>
  </div>
{/if}

<header>
  <h2 class="page-title">{session.place?.name ?? 'Wandeling'}</h2>
  <p class="muted">
    {dateFormat.format(session.startedAt)},
    {timeFormat.format(session.startedAt)}–{session.endedAt
      ? timeFormat.format(session.endedAt)
      : '?'}
    · <button class="link" onclick={rename}>naam wijzigen</button>
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

<ObservationMap {session} focus={mapFocus} onselect={(ids) => (listFocus = { ids })} />

<SessionLog {session} focus={listFocus} onshowonmap={(id) => (mapFocus = { id })} />

<section class="card export">
  <div class="card-head">
    <h2>Klaar met nalopen?</h2>
    {#if session.exportedAt && !exportResult}
      <span class="badge">geëxporteerd</span>
    {/if}
  </div>
  <div class="card-body">
    {#if uncertainCount > 0}
      <p class="warning">
        Nog {uncertainCount === 1 ? '1 onzekere waarneming' : `${uncertainCount} onzekere waarnemingen`}.
        Tik erop om aan te passen, of gebruik "Klopt" of "Weg".
      </p>
    {/if}
    <button class="btn block large" onclick={exportForWaarneming}>Exporteren voor waarneming.nl</button>
    {#if exportResult}
      <p>{exportResult}</p>
    {:else if session.exportedAt}
      <p class="muted">
        Geëxporteerd op {dateFormat.format(session.exportedAt)}
        om {timeFormat.format(session.exportedAt)}.
      </p>
    {/if}
    <p class="muted">
      Importeer het bestand bij <a href={IMPORT_URL} target="_blank" rel="noopener">waarneming.nl</a>.
      Zet de site daarbij op Engels (EN, rechtsboven): gedrag en methode staan in het Engels in het
      bestand.
    </p>
  </div>
</section>

<p class="footer muted">
  {#if resumable}
    Per ongeluk gestopt? <button class="link" onclick={resume}>Wandeling voortzetten</button>
    <br />
  {/if}
  <button class="link danger" onclick={remove}>Wandeling verwijderen</button>
</p>

<style>
  a {
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

  .footer {
    margin: 1.5rem 0 1rem;
    font-size: 0.9rem;
    line-height: 2;
    text-align: center;
  }
</style>
