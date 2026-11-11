<script lang="ts">
  // Inspanning van een sessie zoals die naar eBird gaat (ontwikkeloptie
  // 'ebird', docs/plan-ebird.md, fase 1: alleen kijken).
  import type { Session } from './db';
  import { ebirdProtocol, sessionDurationMs } from './effort';

  let { session }: { session: Session } = $props();

  const METERS_PER_MILE = 1609.344;

  let minutes = $derived(Math.round(sessionDurationMs(session) / 60_000));
  let effort = $derived(session.effort);
  const kmFormat = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 });
</script>

<section class="card">
  <div class="card-head"><h2>eBird</h2></div>
  <div class="card-body">
    {#if effort}
      <dl>
        <dt>Duur</dt>
        <dd>{minutes} min</dd>
        <dt>Afstand</dt>
        <dd>
          {kmFormat.format(effort.distanceM / 1000)} km
          <span class="muted">({(effort.distanceM / METERS_PER_MILE).toFixed(2)} mi)</span>
        </dd>
        <dt>Protocol</dt>
        <dd>{ebirdProtocol(effort)}</dd>
      </dl>
    {:else}
      <p class="muted">Deze sessie is van vóór het bijhouden van duur en afstand.</p>
    {/if}
  </div>
</section>

<style>
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.35rem 1rem;
    margin: 0;
  }

  dt {
    font-weight: 600;
    color: var(--muted);
  }

  dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }

  p {
    margin: 0;
  }
</style>
