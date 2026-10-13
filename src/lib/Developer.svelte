<script lang="ts">
  // Alleen voor de eigenaar (menu en route in App.svelte): feedback van testers
  // lezen, testers uitnodigen, exporteren voor de testset en importeren. Afgeschermd in de interface; de
  // proxy staat het beheer van testers ook alleen de eigenaar toe.
  import {
    addTester,
    inviteLink,
    listSharedNotes,
    listTesters,
    markNotesProcessed,
    removeTester,
    type SharedNote,
    type Tester,
  } from './api';
  import { download, exportAllJson, importJson } from './export';

  let testers = $state<Tester[]>();
  let testersError = $state('');

  async function loadTesters() {
    try {
      testers = await listTesters();
      testersError = '';
    } catch (error) {
      testersError = `Testers ophalen mislukt: ${error instanceof Error ? error.message : error}`;
    }
  }
  loadTesters();

  // Feedback van alle testers, zoals de proxy hem heeft. Komt pas binnen als de
  // app van de tester deelt (na het stoppen van een wandeling). Verwerkt = in
  // een ontwikkelsessie bekeken; de gegevens zelf blijven staan (testset).
  let notes = $state<SharedNote[]>();
  let notesError = $state('');
  let showProcessed = $state(false);
  const newNotes = $derived(notes?.filter((n) => !n.processed) ?? []);
  const processedCount = $derived((notes?.length ?? 0) - newNotes.length);
  const shownNotes = $derived(showProcessed ? (notes ?? []) : newNotes);

  async function loadNotes() {
    try {
      notes = await listSharedNotes();
      notesError = '';
    } catch (error) {
      notesError = `Feedback ophalen mislukt: ${error instanceof Error ? error.message : error}`;
    }
  }
  loadNotes();

  async function setProcessed(ids: string[], processed: boolean) {
    try {
      await markNotesProcessed(ids, processed);
      const changed = new Set(ids);
      notes = notes?.map((n) => (changed.has(n.id) ? { ...n, processed } : n));
    } catch (error) {
      notesError = `Opslaan mislukt: ${error instanceof Error ? error.message : error}`;
    }
  }

  const noteDateFormat = new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  let name = $state('');
  let email = $state('');
  let inviting = $state(false);
  /** Net uitgenodigd: knop naar de mail-app, en de link om te kopiëren */
  let invited = $state<{ name: string; link: string; mailto: string }>();
  let inviteError = $state('');

  /**
   * Maakt een code bij de proxy en toont daarna een knop die de mail-app opent
   * met een kant-en-klaar bericht. De mail gaat vanaf je eigen adres (geen
   * mailserver nodig, komt niet in de spam); het e-mailadres zelf wordt
   * nergens bewaard. De mail-app openen kan niet meteen na het aanmaken:
   * Chrome op Android opent een andere app alleen direct na een tik, en het
   * wachten op de proxy telt niet meer als zo'n tik.
   */
  async function invite(event: SubmitEvent) {
    event.preventDefault();
    inviting = true;
    inviteError = '';
    invited = undefined;
    try {
      const tester = await addTester(name.trim());
      const link = inviteLink(tester.code);
      invited = { name: tester.name, link, mailto: mailto(email.trim(), tester.name, link) };
      name = '';
      email = '';
      await loadTesters();
    } catch (error) {
      inviteError = `Uitnodigen mislukt: ${error instanceof Error ? error.message : error}`;
    } finally {
      inviting = false;
    }
  }

  function mailto(to: string, name: string, link: string): string {
    const greeting = name.charAt(0).toUpperCase() + name.slice(1);
    const body = [
      `Hoi ${greeting},`,
      '',
      'Wil je Fluistervink testen? Met deze app spreek je tijdens het vogelen je waarnemingen in, en thuis loop je ze na en zet je ze op waarneming.nl.',
      '',
      'Open deze link op je telefoon, op Android in Chrome en op een iPhone in Safari:',
      link,
      '',
      'De link is persoonlijk, dus stuur hem niet door. Daarna kun je de app op je beginscherm zetten: in Chrome via het menu, "Toevoegen aan startscherm", in Safari via de deelknop, "Zet op beginscherm". Op een iPhone trilt de app niet; kijk dan even op het scherm of je waarneming erbij staat. In de app staat onder "Hoe werkt het?" hoe je waarnemingen inspreekt.',
      '',
      'Groet,',
    ].join('\n');
    const params = new URLSearchParams({ subject: 'Uitnodiging: Fluistervink testen', body });
    // URLSearchParams maakt van spaties een +, wat mail-apps letterlijk tonen
    return `mailto:${encodeURIComponent(to)}?${params.toString().replace(/\+/g, '%20')}`;
  }

  let copied = $state('');

  async function copyLink(key: string, link: string) {
    await navigator.clipboard.writeText(link);
    copied = key;
    setTimeout(() => (copied = ''), 2000);
  }

  async function remove(tester: Tester) {
    if (!confirm(`${tester.name} afsluiten? De code werkt daarna niet meer.`)) return;
    try {
      await removeTester(tester.name);
      if (invited?.name === tester.name) invited = undefined;
      await loadTesters();
    } catch (error) {
      testersError = `Afsluiten mislukt: ${error instanceof Error ? error.message : error}`;
    }
  }

  const dateFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' });

  let importMessage = $state('');

  async function importData(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const { added, skipped } = await importJson(file);
      importMessage = [
        added === 0
          ? 'Geen nieuwe wandelingen gevonden.'
          : `${added === 1 ? '1 wandeling' : `${added} wandelingen`} geïmporteerd, te vinden bij Vorige wandelingen.`,
        skipped > 0 && `${skipped} stond${skipped === 1 ? '' : 'en'} er al.`,
      ]
        .filter(Boolean)
        .join(' ');
    } catch (error) {
      importMessage = `Importeren mislukt: ${error instanceof Error ? error.message : error}`;
    }
  }

  /** Met opnames: voor de testset, of om terug te kunnen luisteren na importeren */
  let withAudio = $state(false);

  async function exportData() {
    const date = new Date().toISOString().slice(0, 10);
    const suffix = withAudio ? '-met-opnames' : '';
    download(await exportAllJson({ withAudio }), `fluistervink-${date}${suffix}.json`);
  }
</script>

<a class="back" href="#/">Terug</a>
<h2 class="page-title">Developer</h2>

<section class="card">
  <div class="card-head"><h2>Feedback van testers</h2></div>
  <div class="card-body stack">
    {#if notesError}
      <p class="message error">{notesError}</p>
    {/if}
    {#if notes}
      {#if shownNotes.length === 0}
        <p class="hint">Geen nieuwe feedback.</p>
      {:else}
        <ul class="notes">
          {#each shownNotes as note (note.id)}
            <li class:processed={note.processed}>
              <div class="note-meta muted">
                <span>
                  {note.tester} · {noteDateFormat.format(note.recordedAt)}{note.sessionName
                    ? ` · ${note.sessionName}`
                    : ''}
                </span>
                <button class="link" onclick={() => setProcessed([note.id], !note.processed)}>
                  {note.processed ? 'Terugzetten' : 'Verwerkt'}
                </button>
              </div>
              <p class="note-text">{note.text || '(leeg)'}</p>
            </li>
          {/each}
        </ul>
      {/if}
      <div class="note-actions">
        {#if newNotes.length > 1}
          <button
            class="btn secondary"
            onclick={() =>
              setProcessed(
                newNotes.map((n) => n.id),
                true,
              )}>Alles verwerkt</button
          >
        {/if}
        {#if processedCount > 0}
          <button class="link" onclick={() => (showProcessed = !showProcessed)}>
            {showProcessed ? 'Verwerkte verbergen' : `Verwerkte tonen (${processedCount})`}
          </button>
        {/if}
      </div>
    {:else if !notesError}
      <p class="hint">Bezig met ophalen…</p>
    {/if}
    <p class="hint">
      Feedback komt binnen zodra de app van een tester deelt, na het stoppen van een wandeling.
      Verwerkt verbergt hem alleen; de gedeelde wandelingen blijven bewaard.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-head"><h2>Tester uitnodigen</h2></div>
  <form class="card-body stack" onsubmit={invite}>
    <label>
      Naam
      <input
        bind:value={name}
        required
        pattern="[A-Za-z0-9_\-]{'{'}1,32{'}'}"
        title="Zonder spaties of accenten"
        autocapitalize="none"
        autocomplete="off"
      />
    </label>
    <label>
      E-mailadres
      <input type="email" bind:value={email} required autocomplete="off" />
    </label>
    <button class="btn" class:secondary={invited} disabled={inviting}>Code maken</button>
    {#if inviteError}
      <p class="message error">{inviteError}</p>
    {/if}
    {#if invited}
      <p class="message">Code voor {invited.name} gemaakt.</p>
      <a class="btn" href={invited.mailto}>Mail openen</a>
      <p class="hint">
        Opent je mail-app met het bericht. Lukt dat niet,
        <button type="button" class="link" onclick={() => copyLink('new', invited!.link)}>
          {copied === 'new' ? 'gekopieerd' : 'kopieer dan de link'}
        </button>
        en stuur hem zelf.
      </p>
    {/if}
    <p class="hint">
      De naam komt in de feedback en de logs; het e-mailadres wordt nergens bewaard. De mail gaat
      vanaf je eigen adres.
    </p>
  </form>
</section>

<section class="card">
  <div class="card-head"><h2>Testers</h2></div>
  <div class="card-body stack">
    {#if testersError}
      <p class="message error">{testersError}</p>
    {/if}
    {#if testers?.length === 0}
      <p class="hint">Nog geen testers.</p>
    {:else if testers}
      <ul class="testers">
        {#each testers as tester (tester.name)}
          <li>
            <span class="name">
              {tester.name}
              <span class="muted">
                {tester.source === 'secret'
                  ? '· via npm run tester'
                  : tester.invitedAt
                    ? `· ${dateFormat.format(tester.invitedAt)}`
                    : ''}
              </span>
            </span>
            {#if tester.source === 'app' && tester.code}
              <button class="link" onclick={() => copyLink(tester.name, inviteLink(tester.code!))}>
                {copied === tester.name ? 'Gekopieerd' : 'Link'}
              </button>
              <button class="link danger" onclick={() => remove(tester)}>Afsluiten</button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>

<section class="card">
  <div class="card-head"><h2>Gegevens</h2></div>
  <div class="card-body stack">
    <label class="check">
      <input type="checkbox" bind:checked={withAudio} />
      Met opnames (groter bestand; nodig voor de testset)
    </label>
    <button class="btn secondary block" onclick={exportData}>Alle gegevens exporteren (JSON)</button
    >
    <label class="btn secondary block file">
      Wandelingen importeren (JSON)
      <input type="file" accept="application/json,.json" onchange={importData} />
    </label>
    {#if importMessage}
      <p class="message">{importMessage}</p>
    {/if}
    <p class="hint">
      Importeren leest een eerdere export weer in. Alleen wandelingen die er nog niet zijn; opnames
      alleen als ze in de export zitten.
    </p>
  </div>
</section>

<style>
  .stack {
    display: grid;
    gap: 0.75rem;
  }

  label:not(.check, .file) {
    display: grid;
    gap: 0.25rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--muted);
  }

  label input {
    font-weight: 400;
  }

  .testers {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.5rem;
  }

  .testers li {
    display: flex;
    align-items: baseline;
    gap: 1rem;
  }

  .testers .name {
    flex: 1;
    min-width: 0;
  }

  .error {
    color: var(--red);
  }

  .notes {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.75rem;
  }

  .notes li.processed {
    opacity: 0.6;
  }

  .note-meta {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    font-size: 0.85rem;
  }

  .note-text {
    margin: 0.15rem 0 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .note-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .note-actions:empty {
    display: none;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.95rem;
  }

  .file {
    display: flex;
    font-size: 1rem;
    color: var(--fg);
  }

  .file input {
    display: none;
  }

  .message {
    margin: 0;
  }

  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--muted);
  }
</style>
