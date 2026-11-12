<script lang="ts">
  // Wat alleen de gebruiker weet over een sessie als checklist: alles
  // genoteerd, en met hoeveel waarnemers (docs/plan-ebird.md, punt 3 en 8).
  // Staat in het eBird-kaartje en in de vraag na Stop en bij het klaarzetten;
  // elke tik gaat meteen naar de database (`setChecklist`).
  import type { Session } from './db';
  import { resolveChecklist, setChecklist } from './ebirdExport';

  let { session, onanswer }: { session: Session; onanswer?: () => void } = $props();

  // Het kaartje en de vraag kunnen samen op één scherm staan: eigen id's
  const uid = $props.id();

  let checklist = $derived(resolveChecklist(session));

  function answer(complete: boolean) {
    setChecklist(session.id, { complete });
    onanswer?.();
  }
</script>

<div class="field">
  <span class="label" id="{uid}-complete">Heb je alles genoteerd wat je kon herkennen?</span>
  <div class="choice" role="group" aria-labelledby="{uid}-complete">
    <button
      class="btn secondary"
      aria-pressed={checklist.complete === true}
      onclick={() => answer(true)}>Ja</button
    >
    <button
      class="btn secondary"
      aria-pressed={checklist.complete === false}
      onclick={() => answer(false)}>Nee</button
    >
  </div>
  <span class="muted small">
    Dat betekent niet dat je elke vogel telde, wel dat je geen soort bewust wegliet.
  </span>
</div>

<div class="field">
  <span class="label" id="{uid}-observers">Aantal waarnemers</span>
  <div class="stepper" role="group" aria-labelledby="{uid}-observers">
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

<style>
  .field {
    display: grid;
    gap: 0.35rem;
    margin: 1rem 0;
  }

  .label {
    font-weight: 600;
    color: var(--muted);
  }

  .small {
    font-size: 0.85rem;
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
</style>
