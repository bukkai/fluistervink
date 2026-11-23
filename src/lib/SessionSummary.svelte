<script lang="ts">
  import { LOCALE, t } from './i18n';
  // Samenvatting van een sessie (instelling, summary.ts): soortenlijst met
  // aantallen, ook te kopiëren (bv. voor een appgroep).
  import { liveQuery } from 'dexie';
  import type { Session } from './db';
  import { byGroup, sessionSummary } from './summary';
  import { reviewMinutes } from './reviewTime';

  let { session, observationCount }: { session: Session; observationCount: number } = $props();

  // "42 waarnemingen, nagelopen in 3 minuten": pas als de sessie klaarstaat,
  // en alleen als de tijd gemeten is (niet bij sessies van vóór 20 nov 2026)
  let reviewed = $derived.by(() => {
    if (!(session.readyAt || session.exportedAt) || session.reviewMs === undefined) return;
    const minutes = reviewMinutes(session.reviewMs);
    const time = minutes === 0 ? t('summary.underAMinute') : t('summary.minutes', { n: minutes });
    return t('summary.reviewedIn', { n: observationCount, time });
  });

  const lines = $derived(liveQuery(() => sessionSummary(session)));
  let groups = $derived(byGroup($lines ?? []));
  let copied = $state(false);

  async function copy() {
    if (!$lines) return;
    const title = session.place?.name ?? t('common.defaultSessionName');
    const date = new Date(session.startedAt).toLocaleDateString(LOCALE, {
      day: 'numeric',
      month: 'long',
    });
    const text = [
      t('summary.heading', { title, date, n: $lines.length }),
      ...groups.flatMap((group) => [
        ...(group.title ? ['', `${group.title}:`] : []),
        ...group.lines.map((line) => `${line.name} ${line.count}`),
      ]),
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
      <h2>{t('summary.title')}</h2>
      <button class="link" onclick={copy}>
        {copied ? t('summary.copied') : t('summary.copy')}
      </button>
    </div>
    <div class="card-body">
      {#if reviewed}
        <p class="muted reviewed">{reviewed}</p>
      {/if}
      {#each groups as group (group.title ?? '')}
        {#if group.title}
          <h3>{group.title}</h3>
        {/if}
        <ul>
          {#each group.lines as line (line.speciesId)}
            <li>
              <span>{line.name}</span>
              <span class="count">{line.count}</span>
            </li>
          {/each}
        </ul>
      {/each}
    </div>
  </section>
{/if}

<style>
  .reviewed {
    margin: 0 0 0.5rem;
  }

  h3 {
    margin: 0.75rem 0 0.25rem;
    font-size: 0.95rem;
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
</style>
