<script lang="ts">
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
  const PROTOCOLS: { value: EbirdProtocol; label: string }[] = [
    { value: 'Stationary', label: 'Op één plek (Stationary)' },
    { value: 'Traveling', label: 'Onderweg (Traveling)' },
    { value: 'Incidental', label: 'Losse waarnemingen (Incidental)' },
  ];

  let checklist = $derived(resolveChecklist(session));
  let measuredM = $derived(session.effort?.distanceM);
  let ownDistance = $derived(session.checklist?.distanceM !== undefined);
  let automatic = $derived(
    session.effort ? ebirdProtocol(session.effort) : ('Incidental' as EbirdProtocol),
  );

  const kmFormat = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 });

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
    <h2>eBird</h2>
    {#if session.ebirdExportedAt && !exportResult}<span class="badge">geëxporteerd</span>{/if}
  </div>
  <div class="card-body">
    <dl>
      <dt>Duur</dt>
      <dd>{checklist.protocol === 'Incidental' ? '–' : `${checklist.durationMin} min`}</dd>
    </dl>

    <div class="field">
      <label class="label" for="ebird-protocol">Soort telling</label>
      <select id="ebird-protocol" value={session.checklist?.protocol ?? ''} onchange={setProtocol}>
        <option value="">Automatisch: {PROTOCOLS.find((p) => p.value === automatic)?.label}</option>
        {#each PROTOCOLS as protocol (protocol.value)}
          <option value={protocol.value}>{protocol.label}</option>
        {/each}
      </select>
    </div>

    {#if checklist.protocol === 'Traveling'}
      <div class="field">
        <label class="label" for="ebird-distance">Afstand in km</label>
        <input
          id="ebird-distance"
          type="text"
          inputmode="decimal"
          value={checklist.distanceM === undefined ? '' : km(checklist.distanceM)}
          placeholder="bv. 3,5"
          onchange={setDistance}
        />
        <span class="muted small">
          {#if checklist.distanceM !== undefined}
            {(checklist.distanceM / METERS_PER_MILE).toFixed(2)} mijl voor eBird.
          {/if}
          {#if ownDistance && measuredM !== undefined}
            Gemeten: {km(measuredM)} km.
            <button class="link" onclick={() => setChecklist(session.id, { distanceM: undefined })}
              >Terug naar gemeten</button
            >
          {:else if measuredM === undefined}
            Niet gemeten (sessie van vóór 11 november).
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
      Deze sessie hoeft niet naar eBird
    </label>
    <p class="muted small">
      Hij telt dan niet mee bij "Exporteren voor eBird" op het scherm Sessies.
    </p>

    {#if exportResult}
      <p role="status">{exportResult}</p>
    {:else if session.ebirdExportedAt}
      <p class="muted">Geëxporteerd op {dateYearTimeFormat.format(session.ebirdExportedAt)}.</p>
    {/if}
    <button
      class="btn block"
      disabled={busy || checklist.complete === undefined}
      onclick={exportThis}>Exporteren voor eBird</button
    >
    <p class="muted small">
      {#if checklist.complete === undefined}
        Beantwoord eerst de vraag hierboven.
      {/if}
      Importeer het bestand bij
      <a href={EBIRD_IMPORT_URL} target="_blank" rel="noopener">eBird</a> en kies daar bij Format "eBird
      Record Format (Extended)": eBird zet zelf het andere formaat aan, en dan mislukt de import met "Missing
      location name". Soorten die eBird niet herkent, kies je daar zelf.
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
