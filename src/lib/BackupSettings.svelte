<script lang="ts">
  // Back-up maken en terugzetten, voor een nieuwe telefoon of als de app weg
  // was. Zie backup.ts.
  import { onMount } from 'svelte';
  import { backupStatus, lastBackupAt, makeBackup, type BackupStatus } from './backup';
  import { describeImport, importJson } from './export';
  import { isNativeApp } from './native';

  let withAudio = $state(true);
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
      const saved = await makeBackup({ withAudio });
      if (saved) {
        backedUpAt = lastBackupAt();
        message = saved.folder ? `Opgeslagen in ${saved.folder}.` : 'Back-up gedownload.';
        await refresh();
      }
    } catch (error) {
      failed = true;
      message = `Back-up mislukt: ${error instanceof Error ? error.message : error}`;
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
      message = `Terugzetten mislukt: ${error instanceof Error ? error.message : error}`;
    } finally {
      busy = false;
    }
  }

  const dateFormat = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' });

  /** Ruwe schatting: base64 maakt de opnames een derde groter */
  function megabytes(bytes: number): string {
    const mb = (bytes * 4) / 3 / 1_000_000;
    return mb < 1 ? 'minder dan 1 MB' : `ongeveer ${Math.round(mb)} MB`;
  }

  function sessions(n: number): string {
    return n === 1 ? '1 sessie' : `${n} sessies`;
  }
</script>

<section class="card">
  <div class="card-head"><h2>Back-up</h2></div>
  <div class="card-body stack">
    <p class="hint">
      Je sessies staan alleen op deze telefoon. Een back-up bewaart ze als bestand{isNativeApp
        ? ' in Downloads'
        : ''}, zodat je ze kunt terugzetten op een nieuwe telefoon of als de app verwijderd was. Zet
      het bestand ergens anders neer (Drive, je computer) om echt veilig te zijn.
    </p>
    <p class="hint" class:warn={status && status.sinceBackup > 0 && status.sessions > 0}>
      {#if backedUpAt}
        Laatste back-up: {dateFormat.format(backedUpAt)}.
        {#if status && status.sinceBackup > 0}
          Sindsdien {sessions(status.sinceBackup)} erbij.
        {/if}
      {:else if status && status.sessions > 0}
        Nog geen back-up gemaakt van je {sessions(status.sessions)}.
      {:else}
        Nog geen back-up gemaakt.
      {/if}
    </p>
    <label class="check">
      <input type="checkbox" bind:checked={withAudio} />
      Met opnames{status && status.audioBytes > 0 ? ` (${megabytes(status.audioBytes)})` : ''}
    </label>
    <button class="btn block" disabled={busy} onclick={backUp}>
      {busy ? 'Bezig…' : 'Back-up maken'}
    </button>
    <label class="btn secondary block file" class:disabled={busy}>
      Back-up terugzetten
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
      Terugzetten voegt alleen sessies toe die hier nog niet staan; wat er al is, blijft zoals het
      is. Instellingen en je testercode gaan niet mee.
    </p>
  </div>
</section>

<style>
  .stack {
    display: grid;
    gap: 0.75rem;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.95rem;
  }

  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--muted);
  }

  .warn {
    color: var(--fg);
  }

  .message {
    margin: 0;
  }

  .error {
    color: var(--red);
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
