<script lang="ts">
  // Wat is er nieuw? De lijst staat in changelog.ts.
  import { CHANGELOG, TOPICS } from './changelog';
  import { APP_VERSION } from './log';

  const dateFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long' });
  // Middag, zodat een tijdzone de dag niet verschuift
  const formatDate = (date: string) => dateFormat.format(new Date(`${date}T12:00:00`));
</script>

<a class="back" href="#instellingen">Instellingen</a>
<h2 class="page-title">Wat is er nieuw?</h2>

{#each CHANGELOG as entry (entry.date)}
  <section class="card">
    <div class="card-body">
      <h3>{formatDate(entry.date)}</h3>
      {#each TOPICS.filter((topic) => entry.topics[topic]?.length) as topic (topic)}
        <h4>{topic}</h4>
        <ul>
          {#each entry.topics[topic] ?? [] as item, i (i)}
            <li>{item}</li>
          {/each}
        </ul>
      {/each}
    </div>
  </section>
{/each}

<p class="version">Je hebt versie {APP_VERSION}</p>

<style>
  h3 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }

  h4 {
    margin: 0.85rem 0 0.35rem;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--muted);
  }

  h3 + h4 {
    margin-top: 0;
  }

  ul {
    margin: 0;
    padding-left: 1.2rem;
    display: grid;
    gap: 0.35rem;
  }

  section + section {
    margin-top: 0.75rem;
  }

  .version {
    margin: 1.5rem 0 0.5rem;
    font-size: 0.8rem;
    text-align: center;
    color: var(--muted);
  }
</style>
