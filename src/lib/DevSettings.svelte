<script lang="ts">
  // Ontwikkelopties: alleen voor de eigenaar (devOptions.ts)
  import { devOptionOn, setDevOption, type DevOption } from './devOptions';

  interface Item {
    option: DevOption;
    label: string;
    hint: string;
    /** Alleen tonen als de app het kan */
    available?: boolean;
  }

  // Een nieuwe optie komt hier, met haar naam in devOptions.ts
  const items: Item[] = [
    {
      option: 'offlineWachtrij',
      label: 'Wachten op bereik',
      hint: 'Zonder bereik mislukt een uitspraak niet meer: hij blijft bewaard en wordt vanzelf verwerkt zodra er weer verbinding is, op volgorde. Nog zonder eigen trilpatroon of melding op het scherm.',
    },
  ];

  const shown = items.filter((item) => item.available !== false);
  let checked = $state(
    Object.fromEntries(items.map((item) => [item.option, devOptionOn(item.option)])),
  );

  function toggle(item: Item) {
    setDevOption(item.option, checked[item.option]);
  }
</script>

<section class="card">
  <div class="card-head"><h2>Ontwikkelopties</h2></div>
  <div class="card-body stack">
    <p class="hint">Nieuwe functies om eerst zelf te proberen. Alleen jij ziet dit.</p>
    {#if shown.length === 0}
      <p class="hint">Op dit moment geen.</p>
    {/if}
    {#each shown as item (item.option)}
      <label class="check">
        <input type="checkbox" bind:checked={checked[item.option]} onchange={() => toggle(item)} />
        {item.label}
      </label>
      <p class="hint">{item.hint}</p>
    {/each}
  </div>
</section>
