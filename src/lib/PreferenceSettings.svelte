<script lang="ts">
  // Keuzes die standaard aan staan (preferences.ts)
  import { preferenceOn, setPreference, type Preference } from './preferences';

  const items: { preference: Preference; label: string; hint: string }[] = [
    {
      preference: 'zeldzaamOnzeker',
      label: 'Zeldzame soort wordt onzeker',
      hint: 'Kiest de app een soort die bij waarneming.nl zeldzaam of zeer zeldzaam is, dan wordt de waarneming onzeker, zodat je hem thuis bovenaan ziet. Meestal is het een verwisseling met een gewone soort.',
    },
    {
      preference: 'samenvatting',
      label: 'Samenvatting van een sessie',
      hint: 'Bij een afgelopen sessie een soortenlijst met aantallen, met wat je dit jaar voor het eerst zag (op deze telefoon). Te kopiëren, bijvoorbeeld voor een appgroep.',
    },
    {
      preference: 'exportHerinnering',
      label: 'Herinnering aan de export',
      hint: 'Staan sessies een week klaar voor waarneming.nl, of wachten ze al een week om nagelopen te worden, dan zie je een melding op het hoofdscherm. Met "Later" drie dagen niet.',
    },
  ];

  let checked = $state(
    Object.fromEntries(items.map((item) => [item.preference, preferenceOn(item.preference)])),
  );
</script>

<section class="card">
  <div class="card-head"><h2>Nalopen en export</h2></div>
  <div class="card-body stack">
    {#each items as item (item.preference)}
      <label class="check">
        <input
          type="checkbox"
          bind:checked={checked[item.preference]}
          onchange={() => setPreference(item.preference, checked[item.preference])}
        />
        {item.label}
      </label>
      <p class="hint">{item.hint}</p>
    {/each}
  </div>
</section>

<style>
  .stack {
    display: grid;
    gap: 0.75rem;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.95rem;
  }

  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--muted);
  }
</style>
