<script lang="ts">
  import { LOCALE, t } from './i18n';
  import { timeFormat } from './format';
  import type { Observation, Session } from './db';
  import { TUINTEL_FORM_URL, tuintelResult, tuintelText, type TuintelLine } from './tuintelling';

  // Het resultaat van een tuintelling (tuintelling.ts, docs/plan-tuintelling.md):
  // per soort het hoogste aantal, in de volgorde van het formulier van
  // Vogelbescherming, om daar over te nemen. Bovenaan bij een tuintelsessie.

  let { session, observations }: { session: Session; observations: Observation[] } = $props();

  let result = $derived(tuintelResult(observations));
  let anyUncertain = $derived([...result.form, ...result.extra].some((line) => line.uncertain));
  let counted = $derived(result.form.length + result.extra.length);

  const dateFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'full' });
  let date = $derived(dateFormat.format(session.startedAt));
  let time = $derived(timeFormat.format(session.startedAt));

  let copied = $state(false);
  async function copy() {
    const text = tuintelText(result, {
      header: t('tuintel.copyHeader', { date, time }),
      extraHeader: t('tuintel.copyExtra'),
    });
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      // Geen klembord (oude browser of geen toestemming): niets doen
    }
  }
</script>

{#snippet lines(list: TuintelLine[])}
  <ul class="lines">
    {#each list as line (line.speciesId)}
      <li>
        <span>
          {line.name}
          {#if line.uncertain}<small class="uncertain">{t('tuintel.uncertain')}</small>{/if}
        </span>
        <strong>{line.count}</strong>
      </li>
    {/each}
  </ul>
{/snippet}

<section class="card tuintel">
  <div class="card-head">
    <h2>{t('tuintel.title')}</h2>
    {#if counted}
      <button class="link" onclick={copy}>{copied ? t('tuintel.copied') : t('tuintel.copy')}</button
      >
    {/if}
  </div>
  <div class="card-body">
    <p>
      {t('tuintel.introVoor')}
      <a href={TUINTEL_FORM_URL} target="_blank" rel="noopener">mijntuinvogeltelling.nl</a>{t(
        'tuintel.introNa',
      )}
    </p>
    <p class="muted">{t('tuintel.started', { date, time })}</p>

    {#if counted}
      {@render lines(result.form)}
      {#if result.extra.length}
        <h3>{t('tuintel.extraTitle')}</h3>
        {@render lines(result.extra)}
      {/if}
    {:else}
      <p>{t('tuintel.none')}</p>
    {/if}

    {#if result.unknown.length}
      <div class="warning">
        <h3>{t('tuintel.unknownTitle')}</h3>
        <p>{t('tuintel.unknownText')}</p>
        {@render lines(result.unknown)}
      </div>
    {/if}

    {#if anyUncertain}
      <p class="warning">{t('tuintel.uncertainHint')}</p>
    {/if}

    {#if result.flyovers.length}
      <h3 class="muted">{t('tuintel.flyoversTitle')}</h3>
      <div class="muted">{@render lines(result.flyovers)}</div>
    {/if}

    <a class="btn block" href={TUINTEL_FORM_URL} target="_blank" rel="noopener"
      >{t('tuintel.open')}</a
    >
  </div>
</section>

<style>
  .tuintel p {
    margin: 0 0 0.6rem;
  }

  .tuintel a:not(.btn) {
    color: var(--brand-strong);
  }

  h3 {
    margin: 0.9rem 0 0.3rem;
    font-size: 1rem;
  }

  .lines {
    margin: 0 0 0.6rem;
    padding: 0;
    list-style: none;
  }

  .lines li {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.35rem 0;
    border-bottom: 1px solid var(--border);
  }

  .uncertain {
    margin-left: 0.4rem;
    color: var(--amber);
  }

  .warning {
    margin: 0.6rem 0;
    padding: 0.5rem 0.9rem;
    border-radius: var(--radius);
    color: var(--amber);
    background: var(--amber-soft);
  }

  .warning h3 {
    margin-top: 0;
  }

  .warning .lines li {
    border-color: currentColor;
  }

  .btn {
    margin-top: 0.6rem;
  }
</style>
