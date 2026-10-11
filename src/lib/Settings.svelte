<script lang="ts">
  import { onMount } from 'svelte';
  import { ApiError, getAccessCode, getTester, ping, setAccessCode } from './api';
  import { download, exportAllJson, importJson } from './export';
  import { APP_VERSION } from './log';
  import { shareAudio, shareEnabled } from './share';

  let code = $state(getAccessCode());
  let status = $state<'idle' | 'busy' | 'ok' | 'error'>('idle');
  let message = $state('');

  let tester = $state(getTester());

  async function save(event: SubmitEvent) {
    event.preventDefault();
    setAccessCode(code);
    tester = undefined;
    await test();
  }

  // Meteen laten zien of de code werkt
  onMount(() => {
    if (code) test();
  });

  async function test() {
    status = 'busy';
    try {
      tester = await ping();
      status = 'ok';
      message = tester ? `Verbonden als ${tester}.` : 'Verbonden met de proxy.';
    } catch (error) {
      status = 'error';
      message =
        error instanceof ApiError && error.status === 401
          ? 'Toegangscode klopt niet.'
          : 'Proxy niet bereikbaar.';
    }
  }

  const sharing = shareEnabled();
  const sharingAudio = shareAudio();

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
<h2 class="page-title">Instellingen</h2>

<section class="card">
  <div class="card-head"><h2>Toegang</h2></div>
  <form class="card-body" onsubmit={save}>
    <label>
      Toegangscode
      <input type="password" bind:value={code} autocomplete="off" required />
    </label>
    {#if !code}
      <p class="hint">Gekregen via een uitnodigingslink? Open die link dan in Chrome.</p>
    {/if}
    <button class="btn" disabled={status === 'busy'}>Opslaan en testen</button>
    {#if message}
      <p class="message {status}">{message}</p>
    {/if}
  </form>
</section>

<section class="card">
  <div class="card-head"><h2>Delen met de ontwikkelaar</h2></div>
  <div class="card-body stack">
    <p class="hint">
      {sharing ? 'Staat aan' : 'Staat uit'}{sharing && sharingAudio ? ', met opnames' : ''}. Aan- of
      uitzetten bij <a href="#feedback">Feedback</a>; zie ook <a href="#privacy">Privacy</a>.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-head"><h2>Gegevens</h2></div>
  <div class="card-body stack">
    <label class="check">
      <input type="checkbox" bind:checked={withAudio} />
      Met opnames (groter bestand; nodig voor de testset)
    </label>
    <button class="btn secondary block" onclick={exportData}>Alle gegevens exporteren (JSON)</button>
    <label class="btn secondary block file">
      Wandelingen importeren (JSON)
      <input type="file" accept="application/json,.json" onchange={importData} />
    </label>
    {#if importMessage}
      <p class="message">{importMessage}</p>
    {/if}
    <p class="hint">
      Importeren leest een eerdere export weer in. Alleen wandelingen die er nog niet zijn;
      opnames alleen als ze in de export zitten.
    </p>
  </div>
</section>

<p class="version">Fluistervink · versie {APP_VERSION}</p>

<style>
  form,
  .stack {
    display: grid;
    gap: 0.75rem;
  }

  label {
    display: grid;
    gap: 0.25rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--muted);
  }

  label input {
    font-weight: 400;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.95rem;
    font-weight: 400;
    color: var(--fg);
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

  .hint a {
    color: inherit;
  }

  .version {
    margin: 1.5rem 0 1rem;
    font-size: 0.8rem;
    text-align: center;
    color: var(--muted);
  }

  .ok {
    color: var(--brand-strong);
  }

  .error {
    color: var(--red);
  }
</style>
