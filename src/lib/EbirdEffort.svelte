<script lang="ts">
  // Een sessie als eBird-checklist: inspanning nakijken, aanvullen wat de app
  // niet kan weten, en exporteren (ontwikkeloptie 'ebird', docs/plan-ebird.md,
  // fase 2). Wijzigingen gaan meteen naar de database (`setChecklist`).
  import type { EbirdProtocol, Session } from './db';
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
  const dateFormat = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' });

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

    <div class="field">
      <span class="label" id="observers-label">Aantal waarnemers</span>
      <div class="stepper" role="group" aria-labelledby="observers-label">
        <button
          class="btn secondary"
          aria-label="Eén minder"
          disabled={checklist.observers <= 1}
          onclick={() => setChecklist(session.id, { observers: checklist.observers - 1 })}>−</button
        >
        <output aria-live="polite">{checklist.observers}</output>
        <button
          class="btn secondary"
          aria-label="Eén meer"
          onclick={() => setChecklist(session.id, { observers: checklist.observers + 1 })}>+</button
        >
      </div>
    </div>

    <div class="field">
      <span class="label" id="complete-label">Heb je alles genoteerd wat je kon herkennen?</span>
      <div class="choice" role="group" aria-labelledby="complete-label">
        <button
          class="btn secondary"
          aria-pressed={checklist.complete === true}
          onclick={() => setChecklist(session.id, { complete: true })}>Ja</button
        >
        <button
          class="btn secondary"
          aria-pressed={checklist.complete === false}
          onclick={() => setChecklist(session.id, { complete: false })}>Nee</button
        >
      </div>
      <span class="muted small">
        Dat betekent niet dat je elke vogel telde, wel dat je geen soort bewust wegliet.
      </span>
    </div>

    {#if exportResult}
      <p role="status">{exportResult}</p>
    {:else if session.ebirdExportedAt}
      <p class="muted">Geëxporteerd op {dateFormat.format(session.ebirdExportedAt)}.</p>
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
      <a href={EBIRD_IMPORT_URL} target="_blank" rel="noopener">eBird</a> als "eBird Record Format". Soorten
      die eBird niet herkent, kies je daar zelf.
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

  /* Knoppen van 48 px: ook met handschoenen te raken */
  .stepper,
  .choice {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .stepper .btn,
  .choice .btn {
    min-width: 3rem;
    min-height: 3rem;
    font-size: 1.1rem;
  }

  .choice .btn {
    flex: 1;
  }

  .choice .btn[aria-pressed='true'] {
    color: var(--on-brand);
    background: var(--brand);
    box-shadow: none;
  }

  output {
    min-width: 2rem;
    font-size: 1.2rem;
    font-weight: 600;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .badge {
    font-size: 0.8rem;
    color: var(--muted);
  }
</style>
