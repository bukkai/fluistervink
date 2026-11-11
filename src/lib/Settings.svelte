<script lang="ts">
  import {
    ApiError,
    getAccessCode,
    getDisplayName,
    getTester,
    OWNER,
    ping,
    setAccessCode,
    setDisplayName,
  } from './api';
  import { APP_VERSION, CHANNEL } from './log';
  import { nativeAppVersion, shortcutSupported, volumeKeySupported } from './native';
  import BackupSettings from './BackupSettings.svelte';
  import RecordingSettings from './RecordingSettings.svelte';
  import ShareSettings from './ShareSettings.svelte';
  import PreferenceSettings from './PreferenceSettings.svelte';
  import TrektelSettings from './TrektelSettings.svelte';
  import VolumeKeySettings from './VolumeKeySettings.svelte';
  import QuickStartSettings from './QuickStartSettings.svelte';
  import DevSettings from './DevSettings.svelte';

  let code = $state(getAccessCode());
  let status = $state<'idle' | 'busy' | 'ok' | 'error'>('idle');
  let message = $state('');

  let tester = $state(getTester());
  let isOwner = $derived(tester === OWNER);

  // Eigen naam, zodat de ontwikkelaar weet wie een installatie is
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
    tester = undefined;
    await test();
  }

  async function test() {
    status = 'busy';
    try {
      tester = await ping();
      // Een oude testercode is dan net vervangen door een installatie (api.ts)
      code = getAccessCode();
      status = 'ok';
      message = tester ? `Verbonden als ${tester}.` : 'Verbonden met de proxy.';
    } catch (error) {
      status = 'error';
      message =
        error instanceof ApiError && error.status === 401 && getAccessCode()
          ? 'Code klopt niet.'
          : error instanceof ApiError && error.status !== 0
            ? `Aanmelden lukt niet: ${error.message}`
            : 'Proxy niet bereikbaar.';
    }
  }
</script>

<a class="back" href="#/">Terug</a>
<h2 class="page-title">Instellingen</h2>

{#if !isOwner}
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

<PreferenceSettings />

<BackupSettings />

<ShareSettings />

<RecordingSettings />

<TrektelSettings />

{#if volumeKeySupported}
  <VolumeKeySettings />
{/if}

{#if shortcutSupported}
  <QuickStartSettings />
{/if}

{#if isOwner}
  <DevSettings />
{/if}

<p class="version">
  Fluistervink{CHANNEL === 'beta' ? ' beta' : ''} · versie {APP_VERSION}{#if appVersion}<br
    />Android-app {appVersion}{/if}<br /><a class="link" href="#nieuw">Wat is er nieuw?</a>
</p>

<details class="owner-code">
  <summary>Code van de ontwikkelaar</summary>
  <form onsubmit={save}>
    <label>
      Code
      <input type="password" bind:value={code} autocomplete="off" />
    </label>
    <p class="hint">
      Alleen voor de ontwikkelaar; de app werkt zonder code. Leeg laten en opslaan haalt de code
      weg.
    </p>
    <button class="btn" disabled={status === 'busy'}>Opslaan en testen</button>
    {#if message}
      <p class="message {status}">{message}</p>
    {/if}
  </form>
</details>

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

  .owner-code {
    margin: 0 0 1.5rem;
    text-align: center;
  }

  .owner-code form {
    text-align: left;
  }

  summary {
    font-size: 0.85rem;
    color: var(--muted);
    cursor: pointer;
    padding: 0.5rem 0;
  }

  details form {
    margin-top: 0.5rem;
  }

  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--muted);
  }

  .version {
    margin: 1.5rem 0 0.5rem;
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
