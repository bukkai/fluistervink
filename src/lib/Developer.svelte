<script lang="ts">
  // Alleen voor de eigenaar (menu en route in App.svelte): testers uitnodigen,
  // exporteren voor de testset en importeren. Afgeschermd in de interface; de
  // proxy staat het beheer van testers ook alleen de eigenaar toe.
  import { addTester, inviteLink, listTesters, removeTester, type Tester } from './api';
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

  let name = $state('');
  let email = $state('');
  let inviting = $state(false);
  /** Net uitgenodigd: link tonen, voor als de mail-app niet openging */
  let invited = $state<{ name: string; link: string }>();
  let inviteError = $state('');

  /**
   * Maakt een code bij de proxy en opent de mail-app met een kant-en-klaar
   * bericht. De mail gaat vanaf je eigen adres (geen mailserver nodig, komt
   * niet in de spam); het e-mailadres zelf wordt nergens bewaard.
   */
  async function invite(event: SubmitEvent) {
    event.preventDefault();
    inviting = true;
    inviteError = '';
    invited = undefined;
    try {
      const tester = await addTester(name.trim());
      const link = inviteLink(tester.code);
      invited = { name: tester.name, link };
      location.href = mailto(email.trim(), tester.name, link);
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
      'Open deze link op je Android-telefoon in Chrome:',
      link,
      '',
      'De link is persoonlijk, dus stuur hem niet door. Daarna kun je in het menu van Chrome kiezen voor "Toevoegen aan startscherm". In de app staat onder "Hoe werkt het?" hoe je waarnemingen inspreekt.',
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
    <button class="btn" disabled={inviting}>Uitnodigen en mailen</button>
    {#if inviteError}
      <p class="message error">{inviteError}</p>
    {/if}
    {#if invited}
      <p class="message">
        Code voor {invited.name} gemaakt; je mail-app opent met het bericht. Ging die niet open?
        <button type="button" class="link" onclick={() => copyLink('new', invited!.link)}>
          {copied === 'new' ? 'Gekopieerd' : 'Link kopiëren'}
        </button>
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
