<script lang="ts" module>
  // Ontwikkelopties: alleen voor de eigenaar (devOptions.ts). Ze staan in de
  // groep van Instellingen waar ze later als gewone keuze komen, met een
  // label; wordt een optie een keuze voor iedereen, dan blijft ze staan waar
  // ze stond. Teksten alleen in het Nederlands: alleen de eigenaar ziet ze.
  import { devOptionOn, setDevOption, type DevOption } from './devOptions';
  import { syncInsects } from './insects';
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
      hint: 'De vogels van Spanje in plaats van die van Nederland. De proef is voorbij (docs/plan-andere-landen.md): zet dit uit, dan verdwijnt het vinkje.',
      // Alleen nog te zien als hij aan staat, zodat hij uit kan
      available: devOptionOn('spanje'),
    },
    {
      option: 'insecten',
      group: 'understanding',
      label: 'Insecten',
      hint: 'Met "Ook andere dieren inspreken" aan ook insecten: kevers, wantsen, hommels, bijen, wespen, mieren, nachtvlinders, sprinkhanen en zweefvliegen. "Een hommel" wordt Hommel onbekend; een soortnaam ("een aardhommel", "goudhaantje, de kever") zoekt de app op, altijd onzeker. Zonder "kever" of "insect" blijft een vogelnaam een vogel (docs/plan-insecten.md).',
    },
    {
      option: 'tuintelling',
      group: 'field',
      label: 'Tuintelling',
      hint: 'Een tweede knop op het startscherm: "Tuintelling". Je telt een half uur (twee trillen bij nog vijf minuten, drie lange als het om is, dan stopt de sessie vanzelf). Daarna staat bij de sessie per soort het hoogste aantal, om over te nemen in het formulier van Vogelbescherming (docs/plan-tuintelling.md).',
    },
    {
      option: 'oortjesMicrofoon',
      group: 'field',
      label: 'Microfoon van de oortjes',
      hint: 'Met oortjes of een headset neemt de app op met hun microfoon in plaats van die van de telefoon, voor als de telefoon in je zak zit. In de Android-app vraagt hij daarvoor "Apparaten in de buurt". Bluetooth klinkt slechter en een podcast kan even pauzeren; de testset moet laten zien wat het kost.',
    },
    {
      option: 'oortjesKnop',
      group: 'field',
      label: 'Knop op de oortjes',
      hint: 'Met "Opnemen met het scherm uit" aan (bij In het veld) start en stopt ook de knop op de oortjes een opname, als hij bij Fluistervink aankomt: niet als er een podcast speelt, en bij sommige oortjes maar om en om. Daarvoor speelt de app bij het begin een kort stil geluid; bij een koptelefoon met twee apparaten kan dat de muziek van het andere stilzetten. Vanaf app-versie 0.7; daarvóór staat de knop altijd aan.',
      available: screenOffSupported,
    },
    {
      option: 'webviewSlapen',
      group: 'field',
      label: 'Scherm uit: webcode laten slapen (accuproef)',
      hint: 'Alleen om te meten wat het kost dat de app met het scherm uit wakker blijft. Aan: de webcode bevriest weer na een minuut met het scherm uit, er is geen tril na een opname of een stuk van de trektelling, en alles wordt pas verwerkt als het scherm aangaat. Opnemen gaat gewoon door. Na de meting weer uitzetten (docs/draaiboek-testen.md, 3.2).',
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
    if (item.option === 'insecten') void syncInsects();
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
