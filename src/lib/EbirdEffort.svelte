<script lang="ts">
  import { LOCALE, t } from './i18n';
  import { dateYearTimeFormat } from './format';
  // Een sessie als eBird-checklist: inspanning nakijken, aanvullen wat de app
  // niet kan weten, en exporteren (instelling "Ik gebruik eBird",
  // docs/plan-ebird.md). Wijzigingen gaan meteen naar de database (`setChecklist`).
  import type { EbirdProtocol, Session } from './db';
  import ChecklistAnswers from './ChecklistAnswers.svelte';
  import { ebirdProtocol } from './effort';
  import { EBIRD_IMPORT_URL, exportForEbird, resolveChecklist, setChecklist } from './ebirdExport';

  let { session }: { session: Session } = $props();

  const METERS_PER_MILE = 1609.344;
  const PROTOCOLS: { value: EbirdProtocol; label: string }[] = (
    ['Stationary', 'Traveling', 'Incidental'] as const
  ).map((value) => ({ value, label: t(`ebird.protocol.${value}`) }));

  let checklist = $derived(resolveChecklist(session));
  let measuredM = $derived(session.effort?.distanceM);
  let ownDistance = $derived(session.checklist?.distanceM !== undefined);
  let automatic = $derived(
    session.effort ? ebirdProtocol(session.effort) : ('Incidental' as EbirdProtocol),
  );

  const kmFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });

  function km(meters: number): string {
    return kmFormat.format(meters / 1000);
  }

  function setDistance(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const value = input.value.trim().replace(',', '.');
    const kilometers = Number(value);
    if (value === '' || !Number.isFinite(kilometers) || kilometers < 0) {
      // Geen getal: terug naar wat er stond
      input.value = checklist.distanceM === undefined ? '' : km(checklist.distanceM);
      return;
    }
    setChecklist(session.id, { distanceM: Math.round(kilometers * 1000) });
  }

  function setProtocol(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    setChecklist(session.id, { protocol: value ? (value as EbirdProtocol) : undefined });
  }

  let exportResult = $state<string>();
  let busy = $state(false);

  async function exportThis() {
    busy = true;
    try {
      exportResult = (await exportForEbird([session])) ?? exportResult;
    } finally {
      busy = false;
    }
  }
</script>

<section class="card">
  <div class="card-head">
    <h2>{t('ebird.title')}</h2>
    {#if session.ebirdExportedAt && !exportResult}<span class="badge"
        >{t('sessions.badgeExported')}</span
      >{/if}
  </div>
  <div class="card-body">
    <dl>
      <dt>{t('ebird.duration')}</dt>
      <dd>
        {checklist.protocol === 'Incidental'
          ? '–'
          : t('ebird.minutes', { n: checklist.durationMin })}
      </dd>
    </dl>

    <div class="field">
      <label class="label" for="ebird-protocol">{t('ebird.protocol')}</label>
      <select id="ebird-protocol" value={session.checklist?.protocol ?? ''} onchange={setProtocol}>
        <option value=""
          >{t('ebird.protocolAutomatic', {
            protocol: PROTOCOLS.find((p) => p.value === automatic)?.label ?? '',
          })}</option
        >
        {#each PROTOCOLS as protocol (protocol.value)}
          <option value={protocol.value}>{protocol.label}</option>
        {/each}
      </select>
    </div>

    {#if checklist.protocol === 'Traveling'}
      <div class="field">
        <label class="label" for="ebird-distance">{t('ebird.distance')}</label>
        <input
          id="ebird-distance"
          type="text"
          inputmode="decimal"
          value={checklist.distanceM === undefined ? '' : km(checklist.distanceM)}
          placeholder={t('ebird.distancePlaceholder')}
          onchange={setDistance}
        />
        <span class="muted small">
          {#if checklist.distanceM !== undefined}
            {t('ebird.miles', { miles: (checklist.distanceM / METERS_PER_MILE).toFixed(2) })}
          {/if}
          {#if ownDistance && measuredM !== undefined}
            {t('ebird.measured', { km: km(measuredM) })}
            <button class="link" onclick={() => setChecklist(session.id, { distanceM: undefined })}
              >{t('ebird.backToMeasured')}</button
            >
          {:else if measuredM === undefined}
            {t('ebird.notMeasured')}
          {/if}
        </span>
      </div>
    {/if}

    <ChecklistAnswers {session} />

    <label class="check">
      <input
        type="checkbox"
        checked={session.checklist?.skipEbird ?? false}
        onchange={(event) =>
          setChecklist(session.id, { skipEbird: event.currentTarget.checked || undefined })}
      />
      {t('ebird.skip')}
    </label>
    <p class="muted small">
      {t('ebird.skipHint')}
    </p>

    {#if exportResult}
      <p role="status">{exportResult}</p>
    {:else if session.ebirdExportedAt}
      <p class="muted">
        {t('ebird.exportedOn', { date: dateYearTimeFormat.format(session.ebirdExportedAt) })}
      </p>
    {/if}
    <button
      class="btn block"
      disabled={busy || checklist.complete === undefined}
      onclick={exportThis}>{t('sessions.exportEbird')}</button
    >
    <p class="muted small">
      {#if checklist.complete === undefined}
        {t('ebird.answerFirst')}
      {/if}
      {t('ebird.importHintVoor')}
      <a href={EBIRD_IMPORT_URL} target="_blank" rel="noopener">eBird</a>
      {t('ebird.importHintNa')}
    </p>
  </div>
</section>

<style>
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.35rem 1rem;
    margin: 0;
  }

  dt,
  .label {
    font-weight: 600;
    color: var(--muted);
  }

  dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }

  .field {
    display: grid;
    gap: 0.35rem;
    margin: 1rem 0;
  }

  .small {
    font-size: 0.85rem;
  }

  p {
    margin: 0.5rem 0 0;
  }

  a {
    color: var(--brand-strong);
  }

  .badge {
    font-size: 0.8rem;
    color: var(--muted);
  }
</style>
