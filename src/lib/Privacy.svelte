<script lang="ts">
  // Wat er met opnames, locaties en waarnemingen gebeurt. Houd dit gelijk met
  // de code: elke nieuwe plek waar gegevens heen gaan, hoort hier te staan.
  // Het beleid van de aanbieders verandert; de bronnen onderaan zijn nagekeken
  // op de datum die erbij staat.
  //
  // Dezelfde tekst staat als losse pagina op /privacy (standalone), gemaakt bij
  // het bouwen (build/privacyPage.ts): dat adres staat in Google Play, en daar
  // moet hij te lezen zijn zonder de app. Links naar schermen van de app gaan
  // dan via de voorpagina.
  let { standalone = false }: { standalone?: boolean } = $props();
  const app = $derived(standalone ? '/' : '');

  const CONTACT = 'stephan@heg-mus.nl';
</script>

{#if !standalone}<a class="back" href="#/">Terug</a>{/if}
<h2 class="page-title">Privacy</h2>

<section class="card">
  <div class="card-body">
    <h3>Kort gezegd</h3>
    <ul>
      <li>Alles wat je inspreekt, staat eerst op je eigen telefoon.</li>
      <li>
        Voor het verwerken gaat je opname naar OpenAI (spraak naar tekst) en de tekst naar Anthropic
        (tekst naar waarneming). Die gebruiken het niet om hun modellen te trainen.
      </li>
      <li>
        Delen met de ontwikkelaar doe je alleen als je daar ja op zegt, en opnames alleen als je dat
        apart aanzet.
      </li>
      <li>
        Geen account, geen advertenties, geen statistieken, geen route van waar je geweest bent.
      </li>
    </ul>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Wie maakt Fluistervink</h3>
    <p>
      Fluistervink is een persoonlijk project van Stephan Muller. Hij is verantwoordelijk voor wat
      er met je gegevens gebeurt. Vragen, inzage of iets laten wissen: mail naar
      <a href="mailto:{CONTACT}">{CONTACT}</a>, of stuur feedback in de app.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Op je telefoon</h3>
    <p>
      De opname van elke uitspraak, de tekst, het tijdstip, de locatie (alleen op het moment dat je
      begint met inspreken), je waarnemingen en een logboek van wat de app deed (fouten,
      wachttijden) staan in de opslag van de app (of van de browser) op je telefoon. Daar blijven ze
      tot je ze verwijdert. De opnames kun je ook los wissen (zie hieronder).
    </p>
    <p>
      Maak je bij <a href="{app}#instellingen">Instellingen</a> een back-up, dan komt alles (met de opnames
      als je dat aanvinkt) in één bestand op je telefoon (in de Android-app in Downloads). Dat bestand
      gaat nergens heen, tenzij je het zelf ergens neerzet, bijvoorbeeld in Google Drive.
    </p>
    <p>
      In de Android-app staat tijdens een sessie een melding van Fluistervink. Daardoor mag de app
      doorwerken met het scherm uit, en blijft hij je locatie volgen om bij een uitspraak meteen te
      weten waar je bent. Bewaard wordt nog steeds alleen de locatie bij het begin van een
      uitspraak, geen route. Na "Stop" houdt het volgen op.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Wat de app verstuurt</h3>
    <p>
      Alles gaat eerst langs de eigen server van Fluistervink. Die bewaart niets, behalve wat je
      deelt (hieronder) en hoeveel je liet verwerken: per dag en per sessie het aantal uitspraken en
      hoe lang die waren, zonder wat je zei, om de kosten bij te houden. Wel houdt hij een paar
      dagen bij wanneer je de app gebruikte en of er iets misging.
    </p>
    <dl>
      <dt>OpenAI</dt>
      <dd>
        De opname van een uitspraak, met een lijst vogelnamen, om er tekst van te maken. Volgens
        OpenAI wordt dit niet bewaard en niet gebruikt voor training.
      </dd>
      <dt>Anthropic</dt>
      <dd>
        De tekst van je uitspraak plus de laatste waarnemingen van de sessie (zodat "nog drie erbij"
        werkt), met hoe ver die van je af zijn ("300 m hiervandaan"). Geen opname en geen
        coördinaten. Anthropic wist dit binnen 30 dagen en gebruikt het niet voor training.
      </dd>
      <dt>Waarneming.nl</dt>
      <dd>
        De coördinaten van een waarneming, om de naam van het gebied op te zoeken. Gaat via de
        server van Fluistervink, dus zonder je IP-adres of naam.
      </dd>
      <dt>OpenStreetMap</dt>
      <dd>
        Bij het bekijken van de kaart haalt je telefoon kaartstukjes op bij OpenStreetMap. Hun
        server ziet daardoor welk gebied je bekijkt.
      </dd>
      <dt>Google</dt>
      <dd>
        Installeer je de Android-app via Google Play, dan weet Google dat je hem hebt, zoals bij
        elke app. Bij de eerste keer openen vraagt de app Google Play te bevestigen dat het de echte
        app is, op een echt toestel (Play Integrity). Daarvoor gaat er een willekeurig nummer van
        deze installatie naar Google, geen waarnemingen. Verder stuurt de app niets naar Google. Tik
        je op een link naar een plek (zoals "±8 m" of "kaarten-app"), dan opent Google Maps met die
        plek. Sla je een export op in Google Drive, dan staat dat bestand bij Google.
      </dd>
      <dt>Cloudflare</dt>
      <dd>
        De app heeft geen account of code nodig. Om te voorkomen dat iemand met een programma de
        server misbruikt, controleert Cloudflare Turnstile bij de eerste keer openen of er een echte
        browser achter zit (in de Android-app alleen als Google Play het niet bevestigt). Turnstile
        kijkt daarvoor onder andere naar je IP-adres en browser, volgens Cloudflare alleen om robots
        tegen te houden en niet om je te volgen. Daarna krijgt de app een willekeurige naam (zoals
        "app-3f9a2b1c"), zonder iets wat naar jou verwijst. Vul je bij
        <a href="{app}#instellingen">Instellingen</a> je naam in (niet verplicht), dan staat die erbij,
        zodat de ontwikkelaar weet van wie gebruik en feedback komen.
      </dd>
    </dl>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Delen met de ontwikkelaar</h3>
    <p>
      Fluistervink is nog in ontwikkeling. Zeg je ja tegen delen, dan gaan na elke sessie je
      uitspraken als tekst, wat de app ervan maakte, je correcties bij het nalopen, je feedback, het
      logboek van die sessie en de locaties van je waarnemingen naar de ontwikkelaar. Opnames alleen
      als je dat bij <a href="{app}#instellingen">Instellingen</a> aanzet.
    </p>
    <p>
      Het staat bij Cloudflare onder je testernaam, of zonder code onder de willekeurige naam van je
      installatie. Alleen de ontwikkelaar kan het lezen, en gebruikt het alleen om de herkenning en
      de app te verbeteren. Niet doorgeven, niet publiceren. Wil je dat het weg is, stuur dat als
      feedback in de app of mail naar <a href="mailto:{CONTACT}">{CONTACT}</a>: dan wordt alles van
      jou gewist.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Wat je zelf kunt doen</h3>
    <ul>
      <li>
        Delen aan- of uitzetten, met of zonder opnames: <a href="{app}#instellingen">Instellingen</a
        >.
      </li>
      <li>
        Alleen de opnames wissen: onderaan bij een sessie, of alles in één keer bij
        <a href="{app}#instellingen">Instellingen</a>. De sessie, wat je zei als tekst en de
        waarnemingen blijven staan; terugluisteren kan dan niet meer. Opnames die je al met de
        ontwikkelaar gedeeld had, blijven daar staan.
      </li>
      <li>
        Een sessie verwijderen, met alle opnames: bij <a href="{app}#sessies">Vorige sessies</a>.
        Dat is echt weg.
      </li>
      <li>Een kopie van wat je gedeeld hebt: vraag het als feedback in de app of per mail.</li>
      <li>
        Alles wissen: de app verwijderen, of in Chrome de sitegegevens van Fluistervink wissen.
      </li>
      <li>
        Naar waarneming.nl gaat alleen wat je zelf exporteert en daar importeert (zonder opnames).
      </li>
    </ul>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Hoe lang het blijft</h3>
    <ul>
      <li>Op je telefoon: tot je het zelf verwijdert.</li>
      <li>Wat je met de ontwikkelaar deelt: tot je vraagt het te wissen.</li>
      <li>
        Het verbruik (aantallen en duur, zonder wat je zei): blijft bewaard, om kosten en gebruik
        over langere tijd te kunnen zien.
      </li>
      <li>Het logboek van de server (wanneer, en of er iets misging): een paar dagen.</li>
      <li>Bij OpenAI en Anthropic: zie hierboven.</li>
    </ul>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Je rechten</h3>
    <p>
      Volgens de privacywet (AVG) mag je vragen wat er van jou bewaard is, het laten verbeteren of
      wissen, en bezwaar maken. Mail daarvoor naar <a href="mailto:{CONTACT}">{CONTACT}</a>. Ben je
      het niet eens met hoe dat gaat, dan kun je een klacht indienen bij de
      <a href="https://autoriteitpersoonsgegevens.nl/" target="_blank" rel="noopener"
        >Autoriteit Persoonsgegevens</a
      >.
    </p>
  </div>
</section>

<p class="sources">
  Bijgewerkt op 8 november 2026. Bronnen, nagekeken op 28 oktober 2026:
  <a href="https://developers.openai.com/api/docs/guides/your-data" target="_blank" rel="noopener"
    >OpenAI</a
  >,
  <a
    href="https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data"
    target="_blank"
    rel="noopener">Anthropic (bewaren)</a
  >,
  <a
    href="https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training"
    target="_blank"
    rel="noopener">Anthropic (training)</a
  >,
  <a
    href="https://developers.cloudflare.com/workers/observability/logs/workers-logs/"
    target="_blank"
    rel="noopener">Cloudflare</a
  >,
  <a href="https://www.cloudflare.com/turnstile-privacy-policy/" target="_blank" rel="noopener"
    >Turnstile</a
  >,
  <a
    href="https://developer.android.com/google/play/integrity/overview"
    target="_blank"
    rel="noopener">Play Integrity</a
  >.
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

  a {
    color: inherit;
  }

  .sources {
    margin-top: 1rem;
    font-size: 0.85rem;
    color: var(--muted);
  }
</style>
