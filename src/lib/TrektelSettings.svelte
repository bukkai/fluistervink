<script lang="ts">
  import { t } from './i18n';
  // Trektelmodus aan of uit (docs/plan-trektelmodus.md)
  import { setTrektelEnabled, trektelEnabled } from './trektel';

  let enabled = $state(trektelEnabled());

  function toggle() {
    setTrektelEnabled(enabled);
  }
</script>

<section class="card">
  <div class="card-head"><h2>{t('trektel.title')}</h2></div>
  <div class="card-body stack">
    <label class="check">
      <input type="checkbox" bind:checked={enabled} onchange={toggle} />
      {t('trektel.label')}
    </label>
    <p class="hint">{t('trektel.hint1')}</p>
    <p class="hint">{t('trektel.hint2')}</p>
    <p class="hint">{t('trektel.hint3')}</p>
  </div>
</section>
