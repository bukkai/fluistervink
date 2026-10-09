<script lang="ts">
  import type { Session } from './db';
  import SessionLog from './SessionLog.svelte';

  let { session }: { session: Session } = $props();

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

<SessionLog {session} />

<style>
  a {
    color: var(--green);
  }

  .muted {
    color: var(--muted);
  }
</style>
