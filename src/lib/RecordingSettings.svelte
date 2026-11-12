<script lang="ts">
  // Alle opnames op deze telefoon in één keer wissen. Per sessie kan het
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
    if (!current.count || !confirm(confirmDeleteText(current, 'van alle sessies'))) return;
    const deleted = await deleteRecordings();
    message = `${deleted === 1 ? '1 opname' : `${deleted} opnames`} gewist.`;
  }
</script>

<section class="card">
  <div class="card-head"><h2>Opnames</h2></div>
  <div class="card-body stack">
    <p class="hint">
      De app bewaart wat je inspreekt op je telefoon, zodat je het thuis kunt terugluisteren. Wis je
      de opnames, dan blijven de sessies, wat je zei als tekst en de waarnemingen gewoon staan. Per
      sessie kan het ook, onderaan bij die sessie.
    </p>
    {#if $recordings?.count}
      <p class="hint">Op deze telefoon: {describeRecordings($recordings)}.</p>
      <button class="btn danger block" onclick={removeAll}>Alle opnames wissen</button>
    {:else if $recordings}
      <p class="hint">{message || 'Er staan geen opnames op deze telefoon.'}</p>
    {/if}
  </div>
</section>
