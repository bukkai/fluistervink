<script lang="ts">
  import { t } from './i18n';
  // Alle opnames op dit apparaat in één keer wissen. Per sessie kan het
  // ook, onderaan de review. Zie recordings.ts.
  import { liveQuery } from 'dexie';
  import {
    confirmDeleteText,
    countRecordings,
    deleteRecordings,
    describeRecordings,
  } from './recordings';

  const recordings = liveQuery(() => countRecordings());
  let message = $state('');

  async function removeAll() {
    const current = await countRecordings();
    if (!current.count || !confirm(confirmDeleteText(current, t('recordings.scopeAll')))) return;
    const deleted = await deleteRecordings();
    message = t('recordings.deleted', { recordings: t('common.recordings', { n: deleted }) });
  }
</script>

<section class="card">
  <div class="card-head"><h2>{t('recordings.title')}</h2></div>
  <div class="card-body stack">
    <p class="hint">
      {t('recordings.hint')}
    </p>
    {#if $recordings?.count}
      <p class="hint">
        {t('recordings.onDevice', { recordings: describeRecordings($recordings) })}
      </p>
      <button class="btn danger block" onclick={removeAll}>{t('recordings.deleteAll')}</button>
    {:else if $recordings}
      <p class="hint">{message || t('recordings.none')}</p>
    {/if}
  </div>
</section>
