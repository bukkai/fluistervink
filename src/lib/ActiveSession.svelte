<script lang="ts">
  import { liveQuery } from 'dexie';
  import type { Observation, Session, Utterance } from './db';
  import { listObservations, listUtterances, retry, submitText } from './observations';
  import {
    DEFAULT_COUNTING_METHOD,
    activities,
    codeName,
    countingMethods,
    getSpecies,
    lifeStages,
    methods,
  } from './vocab';

  let { session }: { session: Session } = $props();

  // Opnieuw opvragen als de wandeling wisselt; liveQuery volgt daarna zelf de database
  let observations = $derived(liveQuery(() => listObservations(session.id)));
  let utterances = $derived(liveQuery(() => listUtterances(session.id)));

  let text = $state('');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    await submitText(session.id, text);
    text = '';
  }

  const timeFormat = new Intl.DateTimeFormat('nl-NL', { timeStyle: 'short' });

  function details(obs: Observation) {
    return [
      obs.countingMethodId !== DEFAULT_COUNTING_METHOD
        ? codeName(countingMethods, obs.countingMethodId)
        : undefined,
      codeName(activities, obs.activityId),
      codeName(methods, obs.methodId),
      codeName(lifeStages, obs.lifeStageId),
      obs.sex === 'male' ? 'man' : obs.sex === 'female' ? 'vrouw' : undefined,
    ]
      .filter(Boolean)
      .join(', ');
  }

  function statusLabel(u: Utterance): string {
    if (u.undone) return 'teruggedraaid';
    switch (u.status) {
      case 'pending':
      case 'processing':
        return 'bezig…';
      case 'failed':
        return 'fout';
      case 'done':
        if (u.result === 'ignored') return 'niet begrepen';
        return u.result === 'uncertain' ? 'onzeker' : 'verwerkt';
    }
  }
</script>

<form onsubmit={submit}>
  <input
    bind:value={text}
    placeholder="Bv. zes overvliegende houtduiven"
    autocomplete="off"
    enterkeyhint="send"
  />
  <button>Verwerk</button>
</form>

<h2>Waarnemingen</h2>
{#if $observations?.length}
  <ul>
    {#each $observations as obs (obs.id)}
      <li class:uncertain={obs.uncertain}>
        <div>
          <strong>{obs.count} × {getSpecies(obs.speciesId)?.name}</strong>
          <span class="muted">{timeFormat.format(obs.observedAt)}</span>
        </div>
        <div class="muted">{details(obs)}</div>
        {#if obs.uncertain}
          <div class="reason">Onzeker{obs.uncertainReason ? `: ${obs.uncertainReason}` : ''}</div>
        {/if}
      </li>
    {/each}
  </ul>
{:else}
  <p class="muted">Nog niets waargenomen.</p>
{/if}

{#if $utterances?.length}
  <details>
    <summary>Uitspraken ({$utterances.length})</summary>
    <ul>
      {#each $utterances as u (u.id)}
        <li>
          <div>
            “{u.transcript}”
            <span class="status {u.status} {u.result}">{statusLabel(u)}</span>
          </div>
          {#if u.error}
            <div class="reason">{u.error}</div>
          {/if}
          {#if u.status === 'failed'}
            <button class="small" onclick={() => retry(u.id)}>Opnieuw</button>
          {/if}
        </li>
      {/each}
    </ul>
  </details>
{/if}

<style>
  form {
    display: flex;
    gap: 0.5rem;
    margin: 1rem 0;
  }

  input {
    flex: 1;
    min-width: 0;
    padding: 0.75rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    font: inherit;
    background: var(--bg);
    color: var(--fg);
  }

  button {
    padding: 0.75rem 1rem;
    border: none;
    border-radius: 0.5rem;
    font: inherit;
    background: var(--green);
    color: white;
  }

  button.small {
    margin-top: 0.25rem;
    padding: 0.25rem 0.75rem;
  }

  ul {
    padding: 0;
    list-style: none;
  }

  li {
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border);
  }

  li.uncertain {
    border-left: 3px solid var(--amber);
    padding-left: 0.5rem;
  }

  .muted {
    color: var(--muted);
  }

  .reason {
    color: var(--amber);
    font-size: 0.9rem;
  }

  .status {
    font-size: 0.8rem;
    color: var(--muted);
    white-space: nowrap;
  }

  .status.failed,
  .status.ignored {
    color: var(--red);
  }

  .status.uncertain {
    color: var(--amber);
  }

  details {
    margin-top: 1rem;
  }
</style>
