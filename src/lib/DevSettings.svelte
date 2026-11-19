<script lang="ts">
  // Ontwikkelopties: alleen voor de eigenaar (devOptions.ts)
  import { devOptionOn, setDevOption, type DevOption } from './devOptions';
  import { requestBluetoothMicrophone, screenOffSupported } from './native';

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
      option: 'oortjesMicrofoon',
      label: 'Microfoon van de oortjes (proef)',
      hint: 'Met oortjes of een headset neemt de app op met hun microfoon in plaats van die van de telefoon, voor als de telefoon in je zak zit. In de Android-app vraagt hij daarvoor "Apparaten in de buurt". Bluetooth klinkt slechter en een podcast kan even pauzeren; de testset moet laten zien wat het kost.',
    },
    {
      option: 'schermUit',
      label: 'Opnemen met het scherm uit',
      hint: 'Proef: tijdens een sessie start en stopt de volumeknop een opname, ook met het scherm uit. De knop op de oortjes doet dat ook, als hij bij Fluistervink aankomt: niet als er een podcast speelt, en bij sommige oortjes maar om en om. Werkt vanaf de volgende sessie (of open de sessie opnieuw).',
      available: screenOffSupported,
    },
    {
      option: 'english',
      label: 'English',
      hint: 'De app in het Engels: schermen, namen van soorten en gedrag, en inspreken. Uitleg, privacy, welkom, de changelog en deze schermen blijven Nederlands (docs/plan-engels.md, stap 3). Aan- of uitzetten laadt de app opnieuw.',
    },
    {
      option: 'spanje',
      label: 'Spanje (proef)',
      hint: 'De vogels van Spanje in plaats van die van Nederland: bijeneter, blauwe ekster en rode patrijs zijn dan gewoon, en de zeldzaamheid is die van Spanje. Alleen vogels; andere dieren blijven de Nederlandse lijst. Geldt voor nieuwe uitspraken, ook als ze nog op bereik wachten (docs/plan-andere-landen.md). Aan- of uitzetten laadt de app opnieuw.',
    },
  ];

  const shown = items.filter((item) => item.available !== false);
  let checked = $state(
    Object.fromEntries(items.map((item) => [item.option, devOptionOn(item.option)])),
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
