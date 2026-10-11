<script lang="ts">
  import { ApiError, getAccessCode, ping, setAccessCode } from './api';
  import { download, exportAllJson, importJson } from './export';
  import { APP_VERSION } from './log';

  let code = $state(getAccessCode());
  let status = $state<'idle' | 'busy' | 'ok' | 'error'>('idle');
  let message = $state('');

  async function save(event: SubmitEvent) {
    event.preventDefault();
    setAccessCode(code);
    status = 'busy';
    try {
      await ping();
      status = 'ok';
      message = 'Verbonden met de proxy.';
    } catch (error) {
      status = 'error';
      message =
        error instanceof ApiError && error.status === 401
          ? 'Toegangscode klopt niet.'
          : 'Proxy niet bereikbaar.';
    }
  }

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

  async function exportData() {
    const date = new Date().toISOString().slice(0, 10);
    download(await exportAllJson(), `fluistervink-${date}.json`);
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
    <button class="btn" disabled={status === 'busy'}>Opslaan en testen</button>
    {#if message}
      <p class="message {status}">{message}</p>
    {/if}
  </form>
</section>

<section class="card">
  <div class="card-head"><h2>Gegevens</h2></div>
  <div class="card-body stack">
    <button class="btn secondary block" onclick={exportData}>Alle gegevens exporteren (JSON)</button>
    <label class="btn secondary block file">
      Wandelingen importeren (JSON)
      <input type="file" accept="application/json,.json" onchange={importData} />
    </label>
    {#if importMessage}
      <p class="message">{importMessage}</p>
    {/if}
    <p class="hint">
      Importeren leest een eerdere export weer in. Alleen wandelingen die er nog niet zijn; opnames
      zitten niet in de export.
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
