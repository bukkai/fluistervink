<script lang="ts">
  import { onMount } from 'svelte';
  import {
    ApiError,
    getAccessCode,
    getDisplayName,
    getTester,
    ping,
    setAccessCode,
    setDisplayName,
  } from './api';
  import { APP_VERSION, CHANNEL } from './log';
  import { isNativeApp, nativeAppVersion } from './native';
  import ShareSettings from './ShareSettings.svelte';

  let code = $state(getAccessCode());
  let status = $state<'idle' | 'busy' | 'ok' | 'error'>('idle');
  let message = $state('');

  let tester = $state(getTester());
  let hasCode = $state(!!getAccessCode());

  // Eigen naam, alleen zonder code (een tester met code heeft al een naam)
  let displayName = $state(getDisplayName());
  let nameStatus = $state<'idle' | 'busy' | 'ok' | 'error'>('idle');
  let nameMessage = $state('');

  async function saveName(event: SubmitEvent) {
    event.preventDefault();
    nameStatus = 'busy';
    try {
      await setDisplayName(displayName);
      displayName = getDisplayName();
      nameStatus = 'ok';
      nameMessage = displayName ? 'Opgeslagen.' : 'Naam weggehaald.';
    } catch (error) {
      nameStatus = 'error';
      nameMessage = `Opslaan mislukt: ${error instanceof Error ? error.message : error}`;
    }
  }

  let appVersion = $state<string>();
  nativeAppVersion().then((versie) => (appVersion = versie));

  async function save(event: SubmitEvent) {
    event.preventDefault();
    setAccessCode(code);
    hasCode = !!getAccessCode();
    tester = undefined;
    await test();
  }

  // Meteen laten zien of de toegang werkt (met code of als installatie)
  onMount(() => {
    test();
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
        error instanceof ApiError && error.status === 401 && getAccessCode()
          ? 'Testercode klopt niet.'
          : error instanceof ApiError && error.status !== 0
            ? `Aanmelden lukt niet: ${error.message}`
            : 'Proxy niet bereikbaar.';
    }
  }
</script>

<a class="back" href="#/">Terug</a>
<h2 class="page-title">Instellingen</h2>

{#if !hasCode}
  <section class="card">
    <div class="card-head"><h2>Je naam</h2></div>
    <form class="card-body" onsubmit={saveName}>
      <label>
        Naam (niet verplicht)
        <input bind:value={displayName} maxlength="40" autocomplete="name" />
      </label>
      <p class="hint">
        Alleen voor de ontwikkelaar, zodat die weet van wie gebruik en feedback komen. Leeg laten en
        opslaan haalt je naam weg.
      </p>
      <button class="btn" disabled={nameStatus === 'busy'}>Opslaan</button>
      {#if nameMessage}
        <p class="message {nameStatus}">{nameMessage}</p>
      {/if}
    </form>
  </section>
{/if}

<section class="card">
  <div class="card-head"><h2>Toegang</h2></div>
  <form class="card-body" onsubmit={save}>
    <label>
      Testercode (niet nodig)
      <input type="password" bind:value={code} autocomplete="off" />
    </label>
    <p class="hint">
      De app werkt zonder code. Heb je een testercode gekregen, vul hem dan hier in{isNativeApp
        ? ' (hij staat in je uitnodigingsmail)'
        : ', of open de uitnodigingslink in Chrome'}. Leeg laten en opslaan haalt de code weg.
    </p>
    <button class="btn" disabled={status === 'busy'}>Opslaan en testen</button>
    {#if message}
      <p class="message {status}">{message}</p>
    {/if}
  </form>
</section>

<ShareSettings />

<p class="version">
  Fluistervink{CHANNEL === 'beta' ? ' beta' : ''} · versie {APP_VERSION}{#if appVersion}<br
    />Android-app {appVersion}{/if}
</p>

<style>
  form {
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
