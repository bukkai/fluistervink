<script lang="ts">
  import { t } from './i18n';
  import { dateYearTimeFormat } from './format';
  // Back-up maken en terugzetten, voor een nieuwe telefoon of als de app weg
  // was. Zie backup.ts.
  import { onMount } from 'svelte';
  import { backupStatus, lastBackupAt, makeBackup, type BackupStatus } from './backup';
  import { describeImport, importJson } from './export';
  import { nativeFileSaveSupported } from './native';

  let backedUpAt = $state(lastBackupAt());
  let status = $state<BackupStatus>();
  let busy = $state(false);
  let message = $state('');
  let failed = $state(false);

  async function refresh() {
    status = await backupStatus(backedUpAt).catch(() => undefined);
  }
  onMount(refresh);

  async function backUp() {
    busy = true;
    message = '';
    failed = false;
    try {
      const saved = await makeBackup();
      if (saved) {
        backedUpAt = lastBackupAt();
        message = saved.folder
          ? t('backup.savedIn', { folder: saved.folder })
          : t('backup.downloaded');
        await refresh();
      }
    } catch (error) {
      failed = true;
      message = t('backup.failed', {
        error: String(error instanceof Error ? error.message : error),
      });
    } finally {
      busy = false;
    }
  }

  async function restore(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    busy = true;
    failed = false;
    try {
      message = describeImport(await importJson(file));
      await refresh();
    } catch (error) {
      failed = true;
      message = t('backup.restoreFailed', {
        error: String(error instanceof Error ? error.message : error),
      });
    } finally {
      busy = false;
    }
  }

  function sessions(n: number): string {
    return t('common.sessions', { n });
  }
</script>

<section class="card">
  <div class="card-head"><h2>{t('backup.title')}</h2></div>
  <div class="card-body stack">
    <p class="hint">
      {nativeFileSaveSupported ? t('backup.hintNative') : t('backup.hint')}
    </p>
    <p class="hint" class:warn={status && status.sinceBackup > 0 && status.sessions > 0}>
      {#if backedUpAt}
        {t('backup.last', { date: dateYearTimeFormat.format(backedUpAt) })}
        {#if status && status.sinceBackup > 0}
          {t('backup.since', { sessions: sessions(status.sinceBackup) })}
        {/if}
      {:else if status && status.sessions > 0}
        {t('backup.noneYetOf', { sessions: sessions(status.sessions) })}
      {:else}
        {t('backup.noneYet')}
      {/if}
    </p>
    <button class="btn block" disabled={busy} onclick={backUp}>
      {busy ? t('common.busy') : t('backup.make')}
    </button>
    <label class="btn secondary block file" class:disabled={busy}>
      {t('backup.restore')}
      <input
        class="visually-hidden"
        type="file"
        accept="application/json,.json"
        disabled={busy}
        onchange={restore}
      />
    </label>
    {#if message}
      <p class="message" class:error={failed} role="status">{message}</p>
    {/if}
    <p class="hint">
      {t('backup.restoreHint')}
    </p>
  </div>
</section>

<style>
  .warn {
    color: var(--fg);
  }

  .message {
    margin: 0;
  }

  .file {
    display: flex;
    position: relative;
  }

  .file:focus-within {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }

  .file.disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
