<script lang="ts">
  import { t } from './i18n';
  import { ApiError, getAccessCode, getTester, OWNER, ping, setAccessCode } from './api';
  import { APP_VERSION, CHANNEL } from './log';
  import { nativeAppVersion } from './native';
  import BackupSettings from './BackupSettings.svelte';
  import RecordingSettings from './RecordingSettings.svelte';
  import ShareSettings from './ShareSettings.svelte';
  import PreferenceSettings from './PreferenceSettings.svelte';
  import TrektelSettings from './TrektelSettings.svelte';

  let code = $state(getAccessCode());
  let status = $state<'idle' | 'busy' | 'ok' | 'error'>('idle');
  let message = $state('');

  let tester = $state(getTester());
  let isOwner = $derived(tester === OWNER);

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
      message = tester ? t('settings.connectedAs', { tester }) : t('settings.connected');
    } catch (error) {
      status = 'error';
      message =
        error instanceof ApiError && error.status === 401 && getAccessCode()
          ? t('settings.wrongCode')
          : error instanceof ApiError && error.status !== 0
            ? t('settings.signInFailed', { error: error.message })
            : t('settings.proxyUnreachable');
    }
  }
</script>

<a class="back" href="#/">{t('common.back')}</a>
<h2 class="page-title">{t('settings.title')}</h2>

<!-- Volgorde van het veld naar thuis: wat de app verstaat, de bediening, tellen,
     nalopen en export, en dan je gegevens (docs/ontwerp.md, Instellingen) -->
<PreferenceSettings group="understanding" {isOwner} />

<PreferenceSettings group="field" {isOwner} />

<TrektelSettings />

<PreferenceSettings group="review" {isOwner} />

<BackupSettings />

<RecordingSettings />

<ShareSettings showName={!isOwner} />

<p class="version">
  Fluistervink{CHANNEL === 'beta' ? ' beta' : ''} · {t('settings.version', {
    version: APP_VERSION,
  })}{#if appVersion}<br />{t('settings.androidApp', { version: appVersion })}{/if}<br /><a
    class="link"
    href="#nieuw"
  >
    {t('update.whatsNew')}
  </a>
</p>

<details class="owner-code">
  <summary>{t('settings.ownerCode')}</summary>
  <form onsubmit={save}>
    <label>
      {t('settings.codeLabel')}
      <input type="password" bind:value={code} autocomplete="off" />
    </label>
    <p class="hint">
      {t('settings.codeHint')}
    </p>
    <button class="btn" disabled={status === 'busy'}>{t('settings.saveAndTest')}</button>
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

  .version {
    margin: 1.5rem 0 0.5rem;
    font-size: 0.8rem;
    text-align: center;
    color: var(--muted);
  }

  .ok {
    color: var(--brand-strong);
  }
</style>
