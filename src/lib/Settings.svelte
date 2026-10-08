<script lang="ts">
  import { ApiError, getAccessCode, ping, setAccessCode } from './api';

  let code = $state(getAccessCode());
  // Alleen bij het laden: open zolang er nog geen code is ingevuld
  const startOpen = !getAccessCode();
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
</script>

<details open={startOpen}>
  <summary>Instellingen</summary>
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
</details>

<style>
  details {
    margin-top: 2rem;
    color: var(--muted);
  }

  form {
    display: grid;
    gap: 0.75rem;
    margin-top: 0.75rem;
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

  .ok {
    color: var(--green);
  }

  .error {
    color: var(--red);
  }
</style>
