<script lang="ts">
  import { onMount } from 'svelte';
  import { ApiError, getAccessCode, getTester, ping, setAccessCode } from './api';
  import { APP_VERSION } from './log';
  import { nativeAppVersion } from './native';
  import { shareAudio, shareEnabled } from './share';

  let code = $state(getAccessCode());
  let status = $state<'idle' | 'busy' | 'ok' | 'error'>('idle');
  let message = $state('');

  let tester = $state(getTester());

  let appVersion = $state<string>();
  nativeAppVersion().then((versie) => (appVersion = versie));

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

<p class="version">
  Fluistervink · versie {APP_VERSION}{#if appVersion}<br />Android-app {appVersion}{/if}
</p>

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
