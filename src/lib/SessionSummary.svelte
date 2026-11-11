<script lang="ts">
  // Samenvatting van een sessie (ontwikkeloptie, summary.ts): soortenlijst met
  // aantallen en wat dit jaar nieuw is, ook te kopiëren (bv. voor een appgroep).
  import { liveQuery } from 'dexie';
  import type { Session } from './db';
  import { sessionSummary } from './summary';

  let { session }: { session: Session } = $props();

  const lines = $derived(liveQuery(() => sessionSummary(session)));
  let newOnes = $derived($lines?.filter((line) => line.newThisYear) ?? []);
  let copied = $state(false);

  async function copy() {
    if (!$lines) return;
    const title = session.place?.name ?? 'Vogelsessie';
    const date = new Date(session.startedAt).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'long',
    });
    const text = [
      `${title}, ${date}: ${$lines.length} soorten`,
      ...$lines.map(
        (line) => `${line.name} ${line.count}${line.newThisYear ? ' (nieuw dit jaar)' : ''}`,
      ),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      // Geen klembord (oude browser of geen toestemming): niets doen
    }
  }
</script>

{#if $lines?.length}
  <section class="card">
    <div class="card-head">
      <h2>Samenvatting</h2>
      <button class="link" onclick={copy}>{copied ? 'Gekopieerd' : 'Kopiëren'}</button>
    </div>
    <div class="card-body">
      {#if newOnes.length}
        <p class="new">
          Nieuw dit jaar: {newOnes.map((line) => line.name).join(', ')}
        </p>
      {/if}
      <ul>
        {#each $lines as line (line.speciesId)}
          <li>
            <span>{line.name}</span>
            {#if line.newThisYear}<span class="badge">nieuw</span>{/if}
            <span class="count">{line.count}</span>
          </li>
        {/each}
      </ul>
    </div>
  </section>
{/if}

<style>
  .new {
    margin: 0 0 0.75rem;
    font-weight: 600;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  /* Twee kolommen pas als er ruimte is; op een telefoon één */
  @media (min-width: 32rem) {
    ul {
      columns: 2;
      column-gap: 1.5rem;
    }
  }

  li {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    padding: 0.15rem 0;
    break-inside: avoid;
  }

  .count {
    margin-left: auto;
    font-variant-numeric: tabular-nums;
    color: var(--muted);
  }

  .badge {
    font-size: 0.7rem;
    padding: 0 0.35rem;
    border-radius: 0.5rem;
    background: var(--amber-soft);
    color: var(--amber);
  }
</style>
