<script lang="ts">
  import type { Session } from './db';
  import { download } from './export';
  import { renameSession } from './area';
  import { resumeSession } from './sessions';
  import ObservationMap from './ObservationMap.svelte';
  import SessionLog from './SessionLog.svelte';
  import { IMPORT_URL, buildExport, markExported } from './waarnemingExport';

  /** `resumable`: de meest recente wandeling, en er loopt geen andere */
  let { session, resumable }: { session: Session; resumable: boolean } = $props();

  async function resume() {
    if (!confirm('Deze wandeling voortzetten?')) return;
    if (await resumeSession(session.id)) location.hash = '';
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

<a href="#/">← Terug</a>

<h2>{session.place?.name ?? 'Wandeling'}</h2>
<p class="muted">
  {dateFormat.format(session.startedAt)},
  {timeFormat.format(session.startedAt)}–{session.endedAt
    ? timeFormat.format(session.endedAt)
    : '?'}
  <button class="link" onclick={rename}>Naam wijzigen</button>
</p>

{#if resumable}
  <button onclick={resume}>Wandeling voortzetten</button>
{/if}

<section class="export">
  <button onclick={exportForWaarneming}>Exporteren voor waarneming.nl</button>
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

<ObservationMap {session} />

<SessionLog {session} />

<style>
  a {
    color: var(--green);
  }

  button {
    padding: 0.5rem 1rem;
    border: 1px solid var(--green);
    border-radius: 0.5rem;
    font: inherit;
    background: none;
    color: var(--green);
  }

  .muted {
    color: var(--muted);
  }

  .link {
    margin-left: 0.5rem;
    padding: 0;
    border: none;
    text-decoration: underline;
  }

  .export {
    margin: 1rem 0;
  }

  .export p {
    margin: 0.5rem 0 0;
    font-size: 0.9rem;
  }
</style>
