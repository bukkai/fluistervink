<script lang="ts">
  // Keuzes voor iedereen (preferences.ts); eBird en de gesproken bevestiging
  // staan standaard uit
  import { speechSupported, volumeKeySupported } from './native';
  import { preferenceOn, setPreference, type Preference } from './preferences';

  interface Item {
    preference: Preference;
    label: string;
    hint: string;
    /** Alleen tonen als de app het kan (Android-app) */
    available?: boolean;
  }

  const items: Item[] = [
    {
      preference: 'soortgroepen',
      label: 'Ook andere dieren inspreken',
      hint: 'Naast vogels ook zoogdieren, reptielen en amfibieën, dagvlinders en libellen ("twee reeën", "een pad", "een atalanta"). Ze gaan mee naar waarneming.nl; eBird neemt alleen vogels. Uit: de app kiest alleen vogels, wat bij korte namen als "das" of "vos" een vergissing scheelt.',
    },
    {
      preference: 'volumeknop',
      label: 'Volumeknop als inspreekknop',
      hint: 'Tijdens een sessie start een druk op de volumeknop (omhoog of omlaag) een opname, en de volgende druk stopt hem. Handig met handschoenen of met de verrekijker in je andere hand; een Bluetooth-knopje voor selfies werkt ook zo. Het volume regel je tijdens een sessie dan niet met die knop. Werkt alleen met de app op het scherm, niet met het scherm uit.',
      available: volumeKeySupported,
    },
    {
      preference: 'gesproken',
      label: 'Gesproken bevestiging in de oortjes (proef)',
      hint: 'Na het trillen zegt de app wat hij heeft vastgelegd ("houtduif, 6, overvliegend"). Alleen als er oortjes of een headset aan zitten, nooit via de luidspreker. Een podcast gaat even zachter.',
      available: speechSupported,
    },
    {
      preference: 'zeldzaamOnzeker',
      label: 'Zeldzame soort wordt onzeker',
      hint: 'Kiest de app een soort die bij waarneming.nl zeldzaam of zeer zeldzaam is, dan wordt de waarneming onzeker, zodat je hem thuis bovenaan ziet. Meestal is het een verwisseling met een gewone soort.',
    },
    {
      preference: 'samenvatting',
      label: 'Samenvatting van een sessie',
      hint: 'Bij een afgelopen sessie een soortenlijst met aantallen. Te kopiëren, bijvoorbeeld voor een appgroep.',
    },
    {
      preference: 'exportHerinnering',
      label: 'Herinnering aan de export',
      hint: 'Staan sessies een week klaar voor waarneming.nl, of wachten ze al een week om nagelopen te worden, dan zie je een melding op het hoofdscherm. Met "Later" drie dagen niet.',
    },
    {
      preference: 'ebird',
      label: 'Ik gebruik eBird',
      hint: 'Na het stoppen vraagt de app of je alles hebt genoteerd, en bij een sessie staat een kaartje eBird met de duur en de afstand. Bij Sessies exporteer je de nagelopen sessies in één bestand, dat je zelf bij eBird uploadt. Sessies van vóór het aanzetten doen alleen mee als je de vraag erbij beantwoordt.',
    },
  ];

  const shown = items.filter((item) => item.available !== false);
  let checked = $state(
    Object.fromEntries(items.map((item) => [item.preference, preferenceOn(item.preference)])),
  );
</script>

<section class="card">
  <div class="card-head"><h2>Inspreken, nalopen en export</h2></div>
  <div class="card-body stack">
    {#each shown as item (item.preference)}
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
