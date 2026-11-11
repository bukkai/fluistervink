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
      option: 'watZeiIk',
      label: '"Wat zei ik?" tijdens een sessie',
      hint: 'Boven de lijst staat wat de spraakherkenning van je laatste uitspraak verstond, met een knop om de opname te horen. Zo zie je meteen waarom iets misging en kun je het verbeteren.',
    },
    {
      option: 'ebird',
      label: 'eBird: duur en afstand bij het nalopen',
      hint: 'Bij een sessie staat een kaartje met de duur, de afgelegde afstand en het protocol zoals die straks naar eBird gaan. Om te zien of de afstand klopt.',
    },
    {
      option: 'kandidaten',
      label: 'Twijfel tussen soorten',
      hint: 'Twijfel je tussen twee of drie soorten ("fitis of tjiftjaf"), dan wordt het de verzamelsoort als waarneming.nl die heeft, anders de meest waarschijnlijke. Bij het nalopen kies je de soort met één tik.',
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
