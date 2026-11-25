<script lang="ts">
  // Wat er met opnames, locaties en waarnemingen gebeurt. Houd dit gelijk met
  // de code: elke nieuwe plek waar gegevens heen gaan, hoort hier te staan.
  // Het beleid van de aanbieders verandert; de bronnen onderaan zijn nagekeken
  // op de datum die erbij staat.
  //
  // Dezelfde tekst staat als losse pagina op /privacy (standalone), gemaakt bij
  // het bouwen (build/privacyPage.ts): dat adres staat in Google Play, en daar
  // moet hij te lezen zijn zonder de app. Links naar schermen van de app gaan
  // dan naar de app op /app/.
  //
  // De Engelse versie staat in Privacy.en.svelte (ook als /privacy-en): een
  // wijziging hier hoort in dezelfde PR ook daar.
  let { standalone = false }: { standalone?: boolean } = $props();
  const app = $derived(standalone ? '/app/' : '');

  const CONTACT = 'info@fluistervink.nl';
</script>

{#if !standalone}<a class="back" href="#/">Terug</a>{/if}
<h2 class="page-title">Privacy</h2>

<section class="card">
  <div class="card-body">
    <h3>Kort gezegd</h3>
    <ul>
      <li>
        Wat je inspreekt, staat op je eigen telefoon. Geen account, geen advertenties en geen route
        van waar je geweest bent.
      </li>
      <li>
        Om je stem om te zetten in een waarneming gaat de opname naar OpenAI en de tekst naar
        Anthropic. Die trainen er hun modellen niet mee.
      </li>
      <li>
        Met de ontwikkelaar deel je alleen als je daar ja op zegt. Anders ziet de ontwikkelaar
        alleen hoeveel de app gebruikt wordt en een paar anonieme cijfers per sessie, nooit wat je
        zei of waar je was.
      </li>
      <li>
        Delen kun je zelf uitzetten, en alles op je telefoon kun je zelf wissen. Wat al bij de
        ontwikkelaar staat, wordt gewist als je erom vraagt.
      </li>
      <li>
        Fluistervink is een persoonlijk project van Stephan Muller, die verantwoordelijk is voor je
        gegevens. Vragen of iets laten wissen: <a href="mailto:{CONTACT}">{CONTACT}</a>, of stuur
        feedback in de app.
      </li>
    </ul>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Je stem verwerken</h3>
    <p>
      Twee diensten zetten om wat je zegt. Dat gaat via de eigen server van Fluistervink, dus zonder
      je IP-adres of naam.
    </p>
    <dl>
      <dt>OpenAI</dt>
      <dd>
        De opname van een uitspraak, met een lijst vogelnamen, om er tekst van te maken. Volgens
        OpenAI niet bewaard en niet gebruikt voor training.
      </dd>
      <dt>Anthropic</dt>
      <dd>
        De tekst van je uitspraak plus de laatste waarnemingen van de sessie (zodat "nog drie erbij"
        werkt), met hun tijd, je opmerkingen en notities, en hoe ver ze van je af zijn. Geen opname
        en geen coördinaten. Anthropic wist het binnen 30 dagen (langer alleen als de wet dat vraagt
        of als hun systemen misbruik vermoeden, dan tot twee jaar) en traint er niet mee.
      </dd>
    </dl>
    <p>
      Bij een trektelling of tuintelling blijft de microfoon aan tot je stopt, en knipt de app de
      opname in stukken van ongeveer een minuut. Stukken zonder spraak gooit de app meteen weg; de
      rest gaat zoals elke uitspraak naar OpenAI en Anthropic, ook als iemand anders in de buurt
      praat.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Delen met de ontwikkelaar</h3>
    <p>
      Zeg je ja tegen delen, dan gaan na elke sessie je uitspraken als tekst, wat de app ervan
      maakte, je correcties, opmerkingen en notities, de naam van het gebied, je feedback, het
      logboek (met het type toestel en de versie van Android of iOS) en de locaties van je
      waarnemingen naar de ontwikkelaar. Opnames alleen als je dat bij <a href="{app}#instellingen">
        Instellingen
      </a> apart aanzet. Feedback die je buiten een sessie typt, gaat meteen, met het logboek van het
      half uur ervoor.
    </p>
    <p>
      Zeg je per ongeluk een lang getal (zoals een telefoon- of rekeningnummer) of een e-mailadres,
      dan laat de app dat weg voordat er iets gedeeld wordt, en de opname van die uitspraak ook. Op
      je telefoon blijft het staan.
    </p>
    <p>
      Alleen de ontwikkelaar leest het, bij Cloudflare en op de eigen computer van de ontwikkelaar,
      om de app te verbeteren. Soms gaat het opnieuw door de spraakherkenning en het model, om een
      verbetering te testen. Verder gaat het nergens heen. Het staat onder de naam van je
      installatie en blijft tot je vraagt het te wissen: mail naar
      <a href="mailto:{CONTACT}">{CONTACT}</a>, of stuur feedback zolang delen aan staat.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Wat je zelf kunt doen</h3>
    <ul>
      <li>
        Delen aan- of uitzetten, met of zonder opnames: <a href="{app}#instellingen">
          Instellingen
        </a>.
      </li>
      <li>
        Anonieme cijfers per sessie uitzetten: ook bij <a href="{app}#instellingen">
          Instellingen
        </a>.
      </li>
      <li>
        Alleen de opnames wissen: onderaan bij een sessie, of alles bij
        <a href="{app}#instellingen">Instellingen</a>. Tekst en waarnemingen blijven; al gedeelde
        opnames blijven bij de ontwikkelaar.
      </li>
      <li>
        Een sessie helemaal verwijderen: bij <a href="{app}#sessies">Vorige sessies</a>. Een al
        gedeelde sessie blijft bij de ontwikkelaar tot je vraagt hem te wissen.
      </li>
      <li>
        Alles wissen: de app verwijderen, of in Chrome de sitegegevens van Fluistervink wissen.
      </li>
      <li>
        Naar waarneming.nl en eBird gaat alleen het bestand dat je zelf exporteert en daar uploadt
        (zonder opnames).
      </li>
    </ul>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Alle details</h3>
    <p class="muted">Voor wie het precies wil weten.</p>

    <details>
      <summary>Wat er op je telefoon staat</summary>
      <p>
        Opnames, tekst, tijdstip en locatie van elke uitspraak, je waarnemingen, de duur en afstand
        van een sessie en een logboek van wat de app deed staan in de opslag van de app (of de
        browser) op je telefoon, tot je ze verwijdert. Een back-up bij
        <a href="{app}#instellingen">Instellingen</a> is een bestand op je telefoon (in de Android-app
        in Downloads) dat nergens heen gaat, tenzij je het zelf ergens neerzet.
      </p>
      <p>
        In de Android-app staat tijdens een sessie een melding van Fluistervink, zodat de app met
        het scherm uit doorwerkt en je locatie blijft volgen. Bewaard wordt alleen de locatie bij
        het begin van een uitspraak, geen route, plus de afgelegde afstand als één getal. Na "Stop"
        houdt het volgen op. De gesproken bevestiging (als je die aanzet) gebruikt de
        voorleesfunctie van je telefoon; Fluistervink stuurt die tekst nergens heen.
      </p>
    </details>

    <details>
      <summary>De server van Fluistervink</summary>
      <p>
        Alles wat de app verstuurt, gaat eerst langs de eigen server. Die bewaart alleen wat je
        deelt en hoeveel je liet verwerken, voor de kosten en om te zien hoeveel mensen de app
        gebruiken: het aantal uitspraken en hun duur per dag en sessie, met de soort uitspraak, de
        taal en de versie van de app, zonder wat je zei. Dat blijft 13 maanden, daarna alleen nog
        als totaal per week, zonder te zien van wie. Het logboek van de server (wanneer, en of er
        iets misging) blijft een paar dagen.
      </p>
    </details>

    <details>
      <summary>Anonieme cijfers per sessie</summary>
      <p>
        Los van het delen stuurt de app na een sessie een handvol getallen: hoe lang hij duurde (op
        5 minuten), hoeveel uitspraken, waarnemingen en verschillende soorten, hoeveel daarvan
        onzeker, niet begrepen, met de stem verbeterd of mislukt waren, of er op bereik gewacht is,
        of het een trektelling of tuintelling was, of je hebt nagelopen en geëxporteerd, en of het
        de Android-app, een iPhone of de browser was. Dat gebeurt als je de sessie exporteert, of
        een week na het stoppen. Niet waar, op welke dag, welke soorten of wat je zei. De server
        bewaart het zonder je installatie, alleen met de week waarin het binnenkwam en de week
        waarin je installatie begon, dus het is niet terug te leiden naar jou. Zo ziet de
        ontwikkelaar hoe goed de app in het veld werkt. Staat standaard aan; uitzetten bij
        <a href="{app}#instellingen">Instellingen</a>.
      </p>
    </details>

    <details>
      <summary>Kaart, gebiedsnaam en de eerste keer openen</summary>
      <dl>
        <dt>Waarneming.nl</dt>
        <dd>
          De coördinaten van een waarneming, om de naam van het gebied op te zoeken, via de server
          van Fluistervink (dus zonder je IP-adres of naam).
        </dd>
        <dt>OpenStreetMap</dt>
        <dd>Kaartstukjes, als je een kaart bekijkt: hun server ziet welk gebied dat is.</dd>
        <dt>Google</dt>
        <dd>
          Bij de eerste keer openen bevestigt Google Play dat het de echte app is op een echt
          toestel (Play Integrity), met een willekeurig nummer van deze installatie, zonder
          waarnemingen. Verder niets, behalve wat je zelf doet: de app uit Google Play installeren,
          een link naar een plek openen in Google Maps, of een export in Google Drive zetten.
        </dd>
        <dt>Cloudflare</dt>
        <dd>
          In de browser, of als Google Play het niet bevestigt, controleert Cloudflare Turnstile bij
          de eerste keer openen of er een echte browser achter zit, onder andere aan je IP-adres,
          volgens Cloudflare alleen om robots te herkennen en tegen te houden. Daarna heet je
          installatie bijvoorbeeld "app-3f9a2b1c", zonder iets wat naar jou verwijst, tenzij je bij
          <a href="{app}#instellingen">Instellingen</a> je naam invult (niet verplicht). Bij elke installatie
          staat ook of het een iPhone, een Android-toestel of een computer is (dat stuurt je browser zelf
          mee), zodat de ontwikkelaar ziet hoeveel mensen welk soort toestel gebruiken; het merk, het
          model en de versie niet (die staan alleen in het logboek, als je deelt).
        </dd>
      </dl>
    </details>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Je rechten</h3>
    <p>
      Volgens de AVG mag je vragen wat er van jou bewaard is (ook een kopie van wat je deelde), en
      het laten verbeteren of wissen, of bezwaar maken: mail naar
      <a href="mailto:{CONTACT}">{CONTACT}</a>. Een klacht kan bij de
      <a href="https://autoriteitpersoonsgegevens.nl/" target="_blank" rel="noopener">
        Autoriteit Persoonsgegevens
      </a>.
    </p>
  </div>
</section>

<p class="sources">
  Bijgewerkt op 25 november 2026. Bronnen, nagekeken op 25 november 2026:
  <a href="https://developers.openai.com/api/docs/guides/your-data" target="_blank" rel="noopener">
    OpenAI
  </a>,
  <a
    href="https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data"
    target="_blank"
    rel="noopener"
  >
    Anthropic (bewaren)
  </a>,
  <a
    href="https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training"
    target="_blank"
    rel="noopener"
  >
    Anthropic (training)
  </a>,
  <a
    href="https://developers.cloudflare.com/workers/observability/logs/workers-logs/"
    target="_blank"
    rel="noopener"
  >
    Cloudflare
  </a>,
  <a href="https://www.cloudflare.com/turnstile-privacy-policy/" target="_blank" rel="noopener">
    Turnstile
  </a>,
  <a
    href="https://developer.android.com/google/play/integrity/overview"
    target="_blank"
    rel="noopener"
  >
    Play Integrity
  </a>.
</p>

<style>
  section + section {
    margin-top: 0.75rem;
  }

  h3 {
    margin: 0 0 0.4rem;
    font-size: 1rem;
  }

  p,
  ul,
  dl {
    margin: 0;
  }

  p + p {
    margin-top: 0.5rem;
  }

  ul {
    padding-left: 1.2rem;
  }

  li + li {
    margin-top: 0.3rem;
  }

  dt {
    margin-top: 0.6rem;
    font-weight: 600;
  }

  dd {
    margin: 0.1rem 0 0;
  }

  .muted {
    color: var(--muted);
    font-size: 0.9rem;
  }

  details {
    border-top: 1px solid var(--border);
    margin-top: 0.5rem;
  }

  summary {
    cursor: pointer;
    font-weight: 600;
    padding: 0.6rem 0;
  }

  details > p,
  details > dl {
    margin-bottom: 0.6rem;
  }

  a {
    color: inherit;
  }

  .sources {
    margin-top: 1rem;
    font-size: 0.85rem;
    color: var(--muted);
  }
</style>
