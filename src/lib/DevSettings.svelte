<script lang="ts">
  // Ontwikkelopties: alleen voor de eigenaar (devOptions.ts)
  import { devOptionOn, setDevOption, type DevOption } from './devOptions';
  import { speechSupported } from './native';

  interface Item {
    option: DevOption;
    label: string;
    hint: string;
    /** Alleen tonen als de app het kan */
    available?: boolean;
    /** Extra bij omzetten */
  }

  const items: Item[] = [
    {
      option: 'gesproken',
      label: 'Gesproken bevestiging in de oortjes',
      hint: 'Na het trillen zegt de app wat hij heeft vastgelegd ("houtduif, 6, overvliegend"). Alleen als er oortjes of een headset aan zitten, nooit via de luidspreker. Een podcast gaat even zachter.',
      available: speechSupported,
    },
    {
      option: 'voorbeeldzinOnzeker',
      label: 'Voorbeeldzin wordt onzeker',
      hint: 'Verstaat de spraakherkenning precies een van zijn voorbeeldzinnen ("Roepje vink."), dan heeft hij waarschijnlijk niets verstaan en dat zelf ingevuld. De waarneming wordt dan onzeker.',
    },
    {
      option: 'kandidaten',
      label: 'Twijfel tussen soorten',
      hint: 'Twijfel je tussen twee of drie soorten ("fitis of tjiftjaf"), dan wordt het de verzamelsoort als waarneming.nl die heeft, anders de meest waarschijnlijke. Bij het nalopen kies je de soort met één tik.',
    },
    {
      option: 'soortgroepen',
      label: 'Ook zoogdieren, reptielen en amfibieën, dagvlinders en libellen',
      hint: 'Spreek ook een ree, een pad, een atalanta of een bloedrode heidelibel in. Ze krijgen het gedrag en kleed van hun eigen groep en gaan mee naar waarneming.nl; eBird neemt alleen vogels. Een andere prompt, dus een eigen versie in de testset.',
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
    {#each shown as item (item.option)}
      <label class="check">
        <input type="checkbox" bind:checked={checked[item.option]} onchange={() => toggle(item)} />
        {item.label}
      </label>
      <p class="hint">{item.hint}</p>
    {/each}
  </div>
</section>
