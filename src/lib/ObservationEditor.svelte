<script lang="ts">
  import type { Observation, Utterance } from './db';
  import { deleteObservation, editObservation } from './observations';
  import {
    activities,
    countingMethods,
    getSpecies,
    lifeStages,
    methods,
    species,
  } from './vocab';

  // Formulier om één waarneming met de hand te corrigeren, in de review.

  let {
    observation,
    utterance,
    onclose,
  }: { observation: Observation; utterance?: Utterance; onclose: () => void } = $props();

  // Kopie van de waarneming bij het openen; pas bij "Opslaan" naar de database
  // svelte-ignore state_referenced_locally
  const original = observation;
  let speciesName = $state(getSpecies(original.speciesId)?.name ?? '');
  let count = $state(original.count);
  let countingMethodId = $state(original.countingMethodId);
  let activityId = $state(original.activityId);
  let methodId = $state(original.methodId);
  let lifeStageId = $state(original.lifeStageId);
  let sex = $state(original.sex === 'unknown' ? undefined : original.sex);
  let remarks = $state(original.remarks ?? '');
  let uncertain = $state(original.uncertain);

  const speciesByName = new Map(species.map((s) => [s.name.toLowerCase(), s]));
  let selectedSpecies = $derived(speciesByName.get(speciesName.trim().toLowerCase()));
  let valid = $derived(selectedSpecies !== undefined && Number.isInteger(count) && count >= 1);

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!selectedSpecies) return;
    await editObservation(original.id, {
      speciesId: selectedSpecies.id,
      count,
      countingMethodId,
      activityId,
      methodId,
      lifeStageId,
      sex,
      remarks: remarks.trim() || undefined,
      uncertain,
      uncertainReason: uncertain ? original.uncertainReason : undefined,
    });
    onclose();
  }

  async function remove() {
    if (!confirm(`${original.count} × ${getSpecies(original.speciesId)?.name} verwijderen?`)) return;
    await deleteObservation(original.id);
    onclose();
  }

  /** Speelt de opname af waaruit deze waarneming kwam. */
  function play() {
    const url = URL.createObjectURL(utterance!.audio!);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play();
  }
</script>

<form onsubmit={save}>
  {#if utterance?.transcript}
    <p class="source">
      {#if utterance.audio}
        <button type="button" class="play" onclick={play} aria-label="Opname afspelen">▶</button>
      {/if}
      “{utterance.transcript}”
    </p>
  {/if}

  <div class="row">
    <label class="species">
      Soort
      <input
        list="soorten"
        bind:value={speciesName}
        autocomplete="off"
        aria-invalid={!selectedSpecies}
        onfocus={(event) => event.currentTarget.select()}
      />
    </label>
    <label class="count">
      Aantal
      <input type="number" min="1" inputmode="numeric" bind:value={count} />
    </label>
  </div>
  {#if !selectedSpecies}
    <p class="error">Kies een soort uit de lijst.</p>
  {/if}

  <div class="row">
    <label>
      Gedrag
      <select bind:value={activityId}>
        <option value={undefined}>—</option>
        {#each activities as code (code.id)}
          <option value={code.id}>{code.name}</option>
        {/each}
      </select>
    </label>
    <label>
      Methode
      <select bind:value={methodId}>
        <option value={undefined}>—</option>
        {#each methods as code (code.id)}
          <option value={code.id}>{code.name}</option>
        {/each}
      </select>
    </label>
  </div>

  <div class="row">
    <label>
      Kleed/leeftijd
      <select bind:value={lifeStageId}>
        <option value={undefined}>—</option>
        {#each lifeStages as code (code.id)}
          <option value={code.id}>{code.name}</option>
        {/each}
      </select>
    </label>
    <label>
      Geslacht
      <select bind:value={sex}>
        <option value={undefined}>—</option>
        <option value="male">man</option>
        <option value="female">vrouw</option>
      </select>
    </label>
  </div>

  <label>
    Telmethode
    <select bind:value={countingMethodId}>
      {#each countingMethods as code (code.id)}
        <option value={code.id}>{code.name}</option>
      {/each}
    </select>
  </label>

  <label>
    Opmerking
    <textarea bind:value={remarks} rows="2"></textarea>
  </label>

  <label class="check">
    <input type="checkbox" bind:checked={uncertain} />
    Onzeker{original.uncertainReason ? ` (${original.uncertainReason})` : ''}
  </label>

  <div class="buttons">
    <button type="submit" disabled={!valid}>Opslaan</button>
    <button type="button" class="secondary" onclick={onclose}>Annuleren</button>
    <button type="button" class="delete" onclick={remove}>Verwijderen</button>
  </div>
</form>

<datalist id="soorten">
  {#each species as s (s.id)}
    <option value={s.name}></option>
  {/each}
</datalist>

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .row {
    display: flex;
    gap: 0.5rem;
  }

  .row > label {
    flex: 1;
    min-width: 0;
  }

  .row > .count {
    flex: 0 0 5rem;
  }

  label {
    display: flex;
    flex-direction: column;
    font-size: 0.8rem;
    color: var(--muted);
  }

  label.check {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: var(--fg);
  }

  input:not([type='checkbox']),
  select,
  textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    font: inherit;
    font-size: 1rem;
    background: var(--bg);
    color: var(--fg);
  }

  input[aria-invalid='true'] {
    border-color: var(--red);
  }

  .check input {
    width: 1.25rem;
    height: 1.25rem;
  }

  .source {
    margin: 0;
    font-size: 0.9rem;
    color: var(--muted);
  }

  .error {
    margin: 0;
    font-size: 0.8rem;
    color: var(--red);
  }

  .buttons {
    display: flex;
    gap: 0.5rem;
  }

  button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 0.5rem;
    font: inherit;
    background: var(--green);
    color: white;
  }

  button:disabled {
    opacity: 0.5;
  }

  button.secondary {
    background: var(--border);
    color: var(--fg);
  }

  button.delete {
    margin-left: auto;
    background: none;
    color: var(--red);
  }

  button.play {
    padding: 0 0.5rem;
    font-size: 0.8rem;
  }
</style>
