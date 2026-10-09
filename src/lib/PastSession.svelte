<script lang="ts">
  import type { Session } from './db';
  import { resumeSession } from './sessions';
  import SessionLog from './SessionLog.svelte';

  /** `resumable`: de meest recente wandeling, en er loopt geen andere */
  let { session, resumable }: { session: Session; resumable: boolean } = $props();

  async function resume() {
    if (!confirm('Deze wandeling voortzetten?')) return;
    if (await resumeSession(session.id)) location.hash = '';
  }

  const dateFormat = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'full' });
  const timeFormat = new Intl.DateTimeFormat('nl-NL', { timeStyle: 'short' });
</script>

<a href="#/">← Terug</a>

<h2>Wandeling van {dateFormat.format(session.startedAt)}</h2>
<p class="muted">
  {timeFormat.format(session.startedAt)}–{session.endedAt
    ? timeFormat.format(session.endedAt)
    : '?'}
</p>

{#if resumable}
  <button onclick={resume}>Wandeling voortzetten</button>
{/if}

<SessionLog {session} />

<style>
  a {
    color: var(--green);
  }

  button {
    padding: 0.5rem 1rem;
    border: 1px solid var(--green);
    border-radius: 0.5rem;
    font: inherit;
    background: none;
    color: var(--green);
  }

  .muted {
    color: var(--muted);
  }
</style>
