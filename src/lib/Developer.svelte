<script lang="ts">
  // Alleen voor de eigenaar (menu en route in App.svelte): exporteren voor de
  // testset en importeren. Afgeschermd in de interface, niet beveiligd: het
  // gaat om de eigen gegevens op het toestel.
  import { download, exportAllJson, importJson } from './export';

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
<h2 class="page-title">Developer</h2>

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
</style>
