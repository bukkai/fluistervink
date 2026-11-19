<script lang="ts" module>
  // Ontwikkelopties: alleen voor de eigenaar (devOptions.ts). Ze staan in de
  // groep van Instellingen waar ze later als gewone keuze komen, met een
  // label; wordt een optie een keuze voor iedereen, dan blijft ze staan waar
  // ze stond. Teksten alleen in het Nederlands: alleen de eigenaar ziet ze.
  import { devOptionOn, setDevOption, type DevOption } from './devOptions';
  import { requestBluetoothMicrophone, screenOffSupported } from './native';
  import type { SettingsGroup } from './preferences';

  interface Item {
    option: DevOption;
    group: SettingsGroup;
    label: string;
    hint: string;
    /** Alleen tonen als de app het kan */
    available?: boolean;
  }

  // Een nieuwe optie komt hier, met haar naam in devOptions.ts
  const items: Item[] = [
    {
      option: 'english',
      group: 'understanding',
      label: 'English',
      hint: 'De app in het Engels: schermen, namen van soorten en gedrag, en inspreken. Uitleg, privacy, welkom, de changelog en de ontwikkelopties blijven Nederlands (docs/plan-engels.md, stap 3). Aan- of uitzetten laadt de app opnieuw.',
    },
    {
      option: 'spanje',
      group: 'understanding',
      label: 'Spanje',
      hint: 'De vogels van Spanje in plaats van die van Nederland: bijeneter, blauwe ekster en rode patrijs zijn dan gewoon, en de zeldzaamheid is die van Spanje. Alleen vogels; andere dieren blijven de Nederlandse lijst. Geldt ook voor uitspraken die nog op bereik wachten (docs/plan-andere-landen.md). Aan- of uitzetten laadt de app opnieuw.',
    },
    {
      option: 'oortjesMicrofoon',
      group: 'field',
      label: 'Microfoon van de oortjes',
      hint: 'Met oortjes of een headset neemt de app op met hun microfoon in plaats van die van de telefoon, voor als de telefoon in je zak zit. In de Android-app vraagt hij daarvoor "Apparaten in de buurt". Bluetooth klinkt slechter en een podcast kan even pauzeren; de testset moet laten zien wat het kost.',
    },
    {
      option: 'schermUit',
      group: 'field',
      label: 'Opnemen met het scherm uit',
      hint: 'Tijdens een sessie start en stopt de volumeknop een opname, ook met het scherm uit. De knop op de oortjes doet dat ook, als hij bij Fluistervink aankomt: niet als er een podcast speelt, en bij sommige oortjes maar om en om. Werkt vanaf de volgende sessie (of open de sessie opnieuw).',
      available: screenOffSupported,
    },
  ];

  const shown = items.filter((item) => item.available !== false);

  /** De ontwikkelopties in een groep, voor de eigenaar */
  export function devOptionsIn(group: SettingsGroup): Item[] {
    return shown.filter((item) => item.group === group);
  }
</script>

<script lang="ts">
  let { group }: { group: SettingsGroup } = $props();

  let inGroup = $derived(devOptionsIn(group));
  let checked = $state(
    Object.fromEntries(shown.map((item) => [item.option, devOptionOn(item.option)])),
  );

  function toggle(item: Item) {
    setDevOption(item.option, checked[item.option]);
    // Zonder deze toestemming ziet de WebView de microfoon van Bluetooth-oortjes niet
    if (item.option === 'oortjesMicrofoon' && checked[item.option]) {
      void requestBluetoothMicrophone();
    }
    // De taal en het land staan vast zolang de app draait (i18n/index.ts, region.ts)
    if (item.option === 'english' || item.option === 'spanje') location.reload();
  }
</script>

{#each inGroup as item (item.option)}
  <label class="check">
    <input type="checkbox" bind:checked={checked[item.option]} onchange={() => toggle(item)} />
    <span>{item.label} <span class="badge">ontwikkeloptie</span></span>
  </label>
  <p class="hint">{item.hint}</p>
{/each}

<style>
  .badge {
    padding: 0 0.55rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
    color: var(--brand-strong);
    background: color-mix(in srgb, var(--brand) 12%, transparent);
  }
</style>
