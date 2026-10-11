<script lang="ts">
  import type { Observation, Utterance } from './db';
  import { deleteObservation, editObservation } from './observations';
  import {
    activities,
    allSpecies,
    countingMethods,
    getSpecies,
    lifeStages,
    methods,
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
  let privateNote = $state(original.privateNote ?? '');
  let uncertain = $state(original.uncertain);

  const speciesByName = new Map(allSpecies.map((s) => [s.name.toLowerCase(), s]));
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
      privateNote: privateNote.trim() || undefined,
      uncertain,
      uncertainReason: uncertain ? original.uncertainReason : undefined,
    });
    onclose();
  }

  async function remove() {
    // Geen bevestiging nodig: hij komt in "Verwijderd" en is terug te zetten
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
    Eigen notitie (gaat niet mee in de export)
    <textarea bind:value={privateNote} rows="2"></textarea>
  </label>

  <label>
    Opmerking voor waarneming.nl
    <textarea bind:value={remarks} rows="2"></textarea>
  </label>

  <label class="check">
    <input type="checkbox" bind:checked={uncertain} />
    Onzeker{original.uncertainReason ? ` (${original.uncertainReason})` : ''}
  </label>

  <div class="buttons">
    <button type="submit" class="btn" disabled={!valid}>Opslaan</button>
    <button type="button" class="btn secondary" onclick={onclose}>Annuleren</button>
    <button type="button" class="link danger delete" onclick={remove}>Verwijderen</button>
  </div>
</form>

<datalist id="soorten">
  {#each allSpecies as s (s.id)}
    <option value={s.name}></option>
  {/each}
</datalist>

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin: 0.25rem 0 0.25rem;
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
    gap: 0.2rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--muted);
  }

  label.check {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    font-weight: 400;
    color: var(--fg);
  }

  label :global(input),
  label :global(select),
  label :global(textarea) {
    font-weight: 400;
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
    font-size: 0.95rem;
    font-style: italic;
    color: var(--muted);
  }

  .error {
    margin: 0;
    font-size: 0.8rem;
    color: var(--red);
  }

  .buttons {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .delete {
    margin-left: auto;
  }

  button.play {
    margin-right: 0.25rem;
    padding: 0 0.5rem;
    border: none;
    border-radius: 0.4rem;
    font-size: 0.8rem;
    font-style: normal;
    color: white;
    background: var(--brand);
  }
</style>
