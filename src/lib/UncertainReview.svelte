<script lang="ts">
  import { liveQuery } from 'dexie';
  import { audioBlob, type Session } from './db';
  import ObservationEditor from './ObservationEditor.svelte';
  import RarityMark from './RarityMark.svelte';
  import {
    confirmObservation,
    deleteObservation,
    listObservations,
    listUtterances,
  } from './observations';
  import { allActivities, allMethods, codeName, getSpecies } from './vocab';

  // Snel nalopen: de onzekere waarnemingen één voor één, op volgorde van tijd,
  // met wat er gezegd werd. Per waarneming Klopt, Weg, Aanpassen of Overslaan;
  // daarna "Alles klopt" onderaan het scherm voor de rest.

  let { session }: { session: Session } = $props();

  let observations = $derived(liveQuery(() => listObservations(session.id)));
  let utterances = $derived(liveQuery(() => listUtterances(session.id)));

  /** Overgeslagen (of aangepast maar nog onzeker): niet nog eens tonen */
  let skipped = $state<string[]>([]);
  /** Het formulier staat open voor de huidige waarneming */
  let editing = $state(false);

  // Oudste eerst, zoals je de wandeling liep (de lijst is nieuwste eerst)
  let uncertain = $derived(($observations ?? []).filter((obs) => obs.uncertain).reverse());
  let todo = $derived(uncertain.filter((obs) => !skipped.includes(obs.id)));
  let current = $derived(todo[0]);
  let source = $derived($utterances?.find((u) => u.id === current?.utteranceId));
  let species = $derived(current && getSpecies(current.speciesId));

  function skip() {
    if (current) skipped = [...skipped, current.id];
  }

  // Het formulier krijgt een eigen stap in de geschiedenis, zodat de terugknop
  // van Android het sluit (zoals in de lijst)
  function openEditor() {
    if (!history.state?.editor) history.pushState({ editor: true }, '');
    editing = true;
  }

  function closeEditor() {
    // Opgeslagen maar nog onzeker: door naar de volgende
    if (current?.uncertain) skip();
    if (history.state?.editor) history.back();
    else editing = false;
  }

  $effect(() => {
    const onPopState = () => {
      if (!history.state?.editor) editing = false;
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  });

  /** Speelt de opname af waaruit deze waarneming kwam. */
  function play() {
    const url = URL.createObjectURL(audioBlob(source!.audio!));
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play();
  }

  const timeFormat = new Intl.DateTimeFormat('nl-NL', { timeStyle: 'short' });
</script>

{#if uncertain.length > 0}
  <section class="card review" aria-live="polite">
    <div class="card-head">
      <h2>Onzeker nalopen</h2>
      <span class="muted"
        >{todo.length > 0 ? `nog ${todo.length}` : `${uncertain.length} overgeslagen`}</span
      >
    </div>
    <div class="card-body">
      {#if current && editing}
        <ObservationEditor observation={current} utterance={source} onclose={closeEditor} />
      {:else if current}
        <div class="obs">
          <RarityMark rarity={species?.rarity ?? 0} />
          <div class="main">
            <strong class="name">{current.count} × {species?.name}</strong>
            <span class="muted">
              {[
                timeFormat.format(current.observedAt),
                codeName(allActivities, current.activityId),
                codeName(allMethods, current.methodId),
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
            {#if current.uncertainReason}
              <span class="reason">{current.uncertainReason}</span>
            {/if}
          </div>
        </div>
        {#if source?.transcript}
          <p class="source">
            {#if source.audio}
              <button class="play" onclick={play} aria-label="Opname afspelen">▶&#xFE0E;</button>
            {/if}
            “{source.transcript}”
          </p>
        {/if}
        <div class="buttons">
          <button class="btn secondary discard" onclick={() => deleteObservation(current.id)}
            >Weg</button
          >
          <button class="btn secondary" onclick={openEditor}>Aanpassen</button>
          <button class="btn" onclick={() => confirmObservation(current.id)}>Klopt</button>
        </div>
        <p class="skip">
          <button class="link" onclick={skip}>Overslaan</button>
        </p>
      {:else}
        <p>
          Overgeslagen. Pas {uncertain.length === 1 ? 'hem' : 'ze'} aan in de lijst, of bevestig
          {uncertain.length === 1 ? 'hem' : 'ze'} onderaan met "Alles klopt".
        </p>
        <button class="btn secondary block" onclick={() => (skipped = [])}
          >Opnieuw langslopen</button
        >
      {/if}
    </div>
  </section>
{/if}

<style>
  .review {
    border-color: var(--amber);
  }

  .review .card-head .muted {
    font-size: 0.85rem;
    white-space: nowrap;
  }

  .obs {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .obs > :global(.rarity-mark) {
    margin-top: 0.45rem;
  }

  .main {
    display: grid;
    min-width: 0;
  }

  .name {
    font-size: 1.15rem;
  }

  .main .muted {
    font-size: 0.9rem;
  }

  .reason {
    font-size: 0.9rem;
    color: var(--amber);
  }

  .source {
    margin: 0.75rem 0 0;
    font-style: italic;
    color: var(--muted);
  }

  button.play {
    min-width: 2.5rem;
    min-height: 2.5rem;
    margin-right: 0.35rem;
    border: none;
    border-radius: 0.5rem;
    font-style: normal;
    color: white;
    background: var(--brand);
  }

  /* Drie even grote knoppen, Klopt (meestal) rechts onder de duim */
  .buttons {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .buttons .btn {
    min-height: 3rem;
    padding-inline: 0.5rem;
  }

  .buttons .discard {
    color: var(--red);
    box-shadow: inset 0 0 0 1.5px var(--red);
  }

  .skip {
    margin: 0.5rem 0 0;
    text-align: center;
  }

  .skip .link {
    min-height: 2.75rem;
    padding-inline: 1rem;
  }

  p {
    margin: 0 0 0.75rem;
  }
</style>
