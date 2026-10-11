<script lang="ts">
  import { ApiError, getAccessCode, ping, setAccessCode } from './api';
  import { download, exportAllJson } from './export';
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

  async function exportData() {
    const date = new Date().toISOString().slice(0, 10);
    download(await exportAllJson(), `fluistervink-${date}.json`);
  }
</script>

<a class="back" href="#/">← Terug</a>
<h2>Instellingen</h2>

<form onsubmit={save}>
  <label>
    Toegangscode
    <input type="password" bind:value={code} autocomplete="off" required />
  </label>
  <button disabled={status === 'busy'}>Opslaan en testen</button>
  {#if message}
    <p class={status}>{message}</p>
  {/if}
</form>
<button class="secondary" onclick={exportData}>Alle gegevens exporteren (JSON)</button>
<p class="version">Versie {APP_VERSION}</p>

<style>
  .back {
    color: var(--green);
  }

  form {
    display: grid;
    gap: 0.75rem;
  }

  label {
    display: grid;
    gap: 0.25rem;
  }

  input {
    padding: 0.75rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    font: inherit;
    background: var(--bg);
    color: var(--fg);
  }

  button {
    padding: 0.75rem;
    border: none;
    border-radius: 0.5rem;
    font: inherit;
    background: var(--green);
    color: white;
  }

  .secondary {
    width: 100%;
    margin-top: 1.5rem;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg);
  }

  .version {
    font-size: 0.8rem;
    color: var(--muted);
  }

  .ok {
    color: var(--green);
  }

  .error {
    color: var(--red);
  }
</style>
