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

  /** `resumable`: de meest recente wandeling, en er loopt geen andere */
  let { session, resumable }: { session: Session; resumable: boolean } = $props();

  let observations = $derived(liveQuery(() => listObservations(session.id)));
  let uncertainCount = $derived($observations?.filter((obs) => obs.uncertain).length ?? 0);

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

<a class="back" href="#wandelingen">← Wandelingen</a>

<header>
  <h2>{session.place?.name ?? 'Wandeling'}</h2>
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

<ObservationMap {session} />

<SessionLog {session} />

<section class="export">
  <h2>Klaar met nalopen?</h2>
  {#if uncertainCount > 0}
    <p class="muted">
      Nog {uncertainCount === 1 ? '1 onzekere waarneming' : `${uncertainCount} onzekere waarnemingen`}.
      Tik erop om aan te passen, of gebruik "Klopt" of "Weg".
    </p>
  {/if}
  <button class="primary" onclick={exportForWaarneming}>Exporteren voor waarneming.nl</button>
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
    Zet de site daarbij op Engels (EN, rechtsboven): gedrag en methode staan in het Engels in het bestand.
  </p>
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
    color: var(--green);
  }

  header h2 {
    margin: 0.75rem 0 0.25rem;
    font-size: 1.6rem;
  }

  header p {
    margin: 0;
  }

  .muted {
    color: var(--muted);
  }

  button {
    font: inherit;
  }

  .link {
    padding: 0;
    border: none;
    background: none;
    color: var(--green);
    text-decoration: underline;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    margin: 1rem 0;
  }

  .stats div {
    padding: 0.6rem;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
  }

  .stats dt {
    font-size: 0.8rem;
    color: var(--muted);
  }

  .stats dd {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .stats small {
    display: block;
    font-size: 0.8rem;
    font-weight: 400;
    color: var(--amber);
  }

  .export {
    margin: 2rem 0 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border);
  }

  .export h2 {
    margin-top: 0;
  }

  .export p {
    margin: 0.5rem 0 0;
    font-size: 0.9rem;
  }

  .primary {
    width: 100%;
    margin-top: 0.5rem;
    padding: 1rem;
    border: none;
    border-radius: 0.75rem;
    font-size: 1.1rem;
    font-weight: 600;
    background: var(--green);
    color: white;
  }

  .footer {
    font-size: 0.9rem;
    line-height: 2;
  }

  .danger {
    color: var(--red);
  }
</style>
