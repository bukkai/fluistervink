<script lang="ts">
  import { liveQuery } from 'dexie';
  import type { Observation, Session, Utterance } from './db';
  import { listObservations, listUtterances, retry } from './observations';
  import {
    DEFAULT_COUNTING_METHOD,
    activities,
    codeName,
    countingMethods,
    getSpecies,
    lifeStages,
    methods,
  } from './vocab';

  // Waarnemingen en uitspraken van één wandeling; gebruikt voor de lopende
  // wandeling en voor eerdere wandelingen.

  let { session }: { session: Session } = $props();

  // Opnieuw opvragen als de wandeling wisselt; liveQuery volgt daarna zelf de database
  let observations = $derived(liveQuery(() => listObservations(session.id)));
  let utterances = $derived(liveQuery(() => listUtterances(session.id)));

  let queued = $derived(
    $utterances?.filter((u) => u.status === 'pending' || u.status === 'processing').length ?? 0,
  );

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

  /** Leeftijd van de positie als die merkbaar ouder is dan de waarneming */
  function positionAge(obs: Observation): string | undefined {
    if (!obs.position) return undefined;
    const minutes = Math.floor((obs.observedAt - obs.position.fixedAt) / 60_000);
    return minutes >= 1 ? `positie ${minutes} min oud` : undefined;
  }

  /** Van uitspraak tot verwerkt, inclusief de tijd in de wachtrij */
  function duration(u: Utterance): string | undefined {
    if (!u.metrics) return undefined;
    const seconds = (u.metrics.finishedAt - u.recordedAt) / 1000;
    return `${seconds.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} s`;
  }

  function statusLabel(u: Utterance): string {
    if (u.kind === 'dev_note') return 'dev note';
    if (u.undone) return 'teruggedraaid';
    switch (u.status) {
      case 'pending':
        return 'in wachtrij';
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

{#if queued}
  <p class="muted">
    {queued === 1 ? '1 uitspraak' : `${queued} uitspraken`} in de wachtrij (zie Uitspraken)
  </p>
{/if}

<h2>Waarnemingen</h2>
{#if $observations?.length}
  <ul>
    {#each $observations as obs (obs.id)}
      <li class:uncertain={obs.uncertain}>
        <div>
          <strong>{obs.count} × {getSpecies(obs.speciesId)?.name}</strong>
          <span class="muted">{timeFormat.format(obs.observedAt)}</span>
          {#if obs.position}
            <span class="muted">±{Math.round(obs.position.accuracy)} m</span>
            {#if positionAge(obs)}
              <span class="reason">{positionAge(obs)}</span>
            {/if}
          {:else}
            <span class="reason">geen locatie</span>
          {/if}
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
  <h2>Uitspraken ({$utterances.length})</h2>
  <ul>
    {#each $utterances as u (u.id)}
      <li>
        <div>
          “{u.transcript}”
          <span class="status {u.status} {u.result}">{statusLabel(u)}</span>
          {#if duration(u)}
            <span class="status">· {duration(u)}{u.metrics?.wasHidden ? ' (app op achtergrond)' : ''}</span>
          {/if}
        </div>
        {#if u.error}
          <div class="reason">{u.error}</div>
        {/if}
        {#if u.status === 'failed'}
          <button onclick={() => retry(u.id)}>Opnieuw</button>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  button {
    padding: 0.25rem 0.75rem;
    margin-top: 0.25rem;
    border: none;
    border-radius: 0.5rem;
    font: inherit;
    background: var(--green);
    color: white;
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

  .status.note {
    color: var(--green);
  }

  .status.uncertain {
    color: var(--amber);
  }
</style>
