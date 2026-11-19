<script lang="ts">
  import { t } from './i18n';
  import { attachAreaToObservations } from './area';
  import LocationPicker from './LocationPicker.svelte';
  import { placeUnplaced } from './observations';

  // Alle waarnemingen zonder plek in één keer op dezelfde plek, onder de kaart
  // van een sessie. Voor als de GPS het hele stuk geen plek had (trektelling
  // in vliegtuigmodus, binnen): dan hoeft het niet één voor één met Locatie
  // aanpassen. De plek telt als waar je stond; een gezegde plek ("500 m
  // zuid") wordt daarvandaan uitgerekend.

  let { sessionId, count }: { sessionId: string; count: number } = $props();

  let open = $state(false);
  let chosen = $state<{ lat: number; lon: number; accuracy?: number }>();
  let saving = $state(false);

  function close() {
    open = false;
    chosen = undefined;
  }

  async function save() {
    if (!chosen) return;
    saving = true;
    try {
      const { lat, lon, accuracy } = chosen;
      const ids = await placeUnplaced(sessionId, lat, lon, accuracy);
      close();
      // Gebied en sessienaam; zonder verbinding later vanzelf bij het openen
      attachAreaToObservations(sessionId, ids, { lat, lon });
    } finally {
      saving = false;
    }
  }
</script>

{#if open}
  <div class="picker card">
    <div class="card-body stack">
      <p>{t('unplaced.question', { n: count })}</p>
      <LocationPicker
        {sessionId}
        onplace={(lat, lon, accuracy) => (chosen = { lat, lon, accuracy })}
      />
      <div class="buttons">
        <button type="button" class="btn secondary" onclick={close}>{t('editor.cancel')}</button>
        <button type="button" class="btn" onclick={save} disabled={!chosen || saving}>
          {t('common.save')}
        </button>
      </div>
    </div>
  </div>
{:else}
  <button type="button" class="btn secondary place" onclick={() => (open = true)}>
    {t('unplaced.choose', { n: count })}
  </button>
{/if}

<style>
  .picker {
    margin-top: 0.6rem;
  }

  .place {
    margin-top: 0.4rem;
  }

  .picker p {
    margin: 0;
  }

  .buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
</style>
