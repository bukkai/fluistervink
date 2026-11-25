<script lang="ts">
  import { t } from './i18n';
  import { timeFormat } from './format';
  import { liveQuery } from 'dexie';
  import { type Session } from './db';
  import { player } from './player.svelte';
  import { tapGuard } from './tapGuard';
  import ObservationEditor from './ObservationEditor.svelte';
  import RarityMark from './RarityMark.svelte';
  import {
    chooseCandidate,
    confirmObservation,
    deleteObservation,
    listObservations,
    listUtterances,
  } from './observations';
  import { activityLabel, getSpecies, methodLabel, speciesLabel } from './vocab';

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
  /** De waarneming die in het formulier openstaat */
  let editingId: string | undefined;

  // Oudste eerst, in de volgorde waarin je ze zag (de lijst is nieuwste eerst)
  let uncertain = $derived(($observations ?? []).filter((obs) => obs.uncertain).reverse());
  let todo = $derived(uncertain.filter((obs) => !skipped.includes(obs.id)));
  let current = $derived(todo[0]);
  let source = $derived($utterances?.find((u) => u.id === current?.utteranceId));
  let species = $derived(current && getSpecies(current.speciesId));

  // Na Klopt, Weg of Overslaan staat de volgende op dezelfde plek
  const once = tapGuard();

  function skip() {
    if (current) skipped = [...skipped, current.id];
  }

  // Het formulier krijgt een eigen stap in de geschiedenis, zodat de terugknop
  // van Android het sluit (zoals in de lijst)
  function openEditor() {
    if (!history.state?.editor) history.pushState({ editor: true }, '');
    editingId = current?.id;
    editing = true;
  }

  /**
   * Opslaan maakt de waarneming zeker (het formulier zet Onzeker uit), dan
   * valt hij vanzelf uit de lijst. Heb je Onzeker weer aangevinkt, dan door
   * naar de volgende. Op het id van bij het openen, niet `current`: die kan
   * na het opslaan al de volgende zijn. Annuleren: terug naar dezelfde.
   */
  function closeEditor(saved = false) {
    if (saved && editingId && !skipped.includes(editingId)) skipped = [...skipped, editingId];
    editingId = undefined;
    editing = false;
    if (history.state?.editor) history.back();
  }

  $effect(() => {
    const onPopState = () => {
      if (!history.state?.editor) editing = false;
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  });

  // Stoppen met afspelen bij het verlaten van het scherm
  $effect(() => player.stop);
</script>

{#if uncertain.length > 0}
  <section class="card review" aria-live="polite">
    <div class="card-head">
      <h2>{t('review.title')}</h2>
      <span class="muted">
        {todo.length > 0
          ? t('review.left', { n: todo.length })
          : t('review.skippedCount', { n: uncertain.length })}
      </span>
    </div>
    <div class="card-body">
      {#if current && editing}
        <ObservationEditor
          observation={current}
          utterance={source}
          onclose={closeEditor}
          reviewing
        />
      {:else if current}
        <div class="obs">
          <RarityMark rarity={species?.rarity ?? 0} />
          <div class="main">
            <strong class="name">{current.count} × {speciesLabel(current.speciesId)}</strong>
            <span class="muted">
              {[
                timeFormat.format(current.observedAt),
                activityLabel(current.speciesId, current.activityId),
                methodLabel(current.speciesId, current.methodId),
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
              <button
                class="play"
                onclick={() => player.toggle(source!.id, source!.audio!)}
                aria-label={player.label(source.id)}
              >
                {player.symbol(source.id)}
              </button>
            {:else if source.audioDeletedAt}
              <span class="muted">{t('log.audioDeleted')}</span>
            {/if}
            “{source.transcript}”
          </p>
        {/if}
        {#if current.candidates?.length}
          <div class="candidates" role="group" aria-label={t('review.whichSpecies')}>
            {#each current.candidates as candidate (candidate)}
              <button
                class="btn secondary"
                onclick={once(() => chooseCandidate(current.id, candidate))}
              >
                {speciesLabel(candidate)}
              </button>
            {/each}
          </div>
        {/if}
        <div class="buttons">
          <button class="btn secondary discard" onclick={once(() => deleteObservation(current.id))}>
            {t('log.discard')}
          </button>
          <button class="btn secondary" onclick={openEditor}>{t('review.edit')}</button>
          <button class="btn" onclick={once(() => confirmObservation(current.id))}>
            {t('log.confirm')}
          </button>
        </div>
        <p class="skip">
          <button class="link" onclick={once(skip)}>{t('review.skip')}</button>
        </p>
      {:else}
        <p>
          {t('review.skipped', { n: uncertain.length })}
        </p>
        <button class="btn secondary block" onclick={() => (skipped = [])}>
          {t('review.again')}
        </button>
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

  /* Kandidaten: elk een eigen knop, zodat de keuze één tik is */
  .candidates {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .candidates .btn {
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
