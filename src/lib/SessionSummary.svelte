<script lang="ts">
  // Samenvatting van een sessie (instelling, summary.ts): soortenlijst met
  // aantallen, ook te kopiëren (bv. voor een appgroep).
  import { liveQuery } from 'dexie';
  import type { Session } from './db';
  import { sessionSummary } from './summary';

  let { session }: { session: Session } = $props();

  const lines = $derived(liveQuery(() => sessionSummary(session)));
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
      ...$lines.map((line) => `${line.name} ${line.count}`),
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
      <ul>
        {#each $lines as line (line.speciesId)}
          <li>
            <span>{line.name}</span>
            <span class="count">{line.count}</span>
          </li>
        {/each}
      </ul>
    </div>
  </section>
{/if}

<style>
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
</style>
