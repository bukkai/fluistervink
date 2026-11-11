<script lang="ts">
  // Ontwikkelopties: alleen voor de eigenaar (devOptions.ts)
  import { devOptionOn, setDevOption, type DevOption } from './devOptions';
  import { setShortcut, shortcutSupported, speechSupported } from './native';

  interface Item {
    option: DevOption;
    label: string;
    hint: string;
    /** Alleen tonen als de app het kan */
    available?: boolean;
    /** Extra bij omzetten */
    onChange?: (on: boolean) => void;
  }

  const items: Item[] = [
    {
      option: 'gesproken',
      label: 'Gesproken bevestiging in de oortjes',
      hint: 'Na het trillen zegt de app wat hij heeft vastgelegd ("houtduif, 6, overvliegend"). Alleen als er oortjes of een headset aan zitten, nooit via de luidspreker. Een podcast gaat even zachter.',
      available: speechSupported,
    },
    {
      option: 'snelkoppeling',
      label: 'Snelkoppeling "Begin met vogelen"',
      hint: 'Lang drukken op het pictogram van de app (of de snelkoppeling op je beginscherm slepen) start meteen een sessie.',
      available: shortcutSupported,
      onChange: setShortcut,
    },
    {
      option: 'trektelpauze',
      label: 'Trektelling pauzeert bij een andere app',
      hint: 'Ga je tijdens een trektelling even naar Merlin (of gaat het scherm op slot), dan stopt de telling niet maar pauzeert hij: de microfoon gaat uit, zodat Merlin hem kan gebruiken (één lange tril). Kom je binnen een kwartier terug, dan luistert de app weer verder (kort tikje); anders stopt de telling alsnog.',
    },
    {
      option: 'zeldzaamOnzeker',
      label: 'Zeldzame soort wordt onzeker',
      hint: 'Kiest de app een soort die bij waarneming.nl zeldzaam of zeer zeldzaam is, dan wordt de waarneming onzeker, zodat je hem thuis bovenaan ziet. Meestal is het een verwisseling met een gewone soort.',
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
  ];

  const shown = items.filter((item) => item.available !== false);
  let checked = $state(
    Object.fromEntries(items.map((item) => [item.option, devOptionOn(item.option)])),
  );

  function toggle(item: Item) {
    setDevOption(item.option, checked[item.option]);
    item.onChange?.(checked[item.option]);
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
