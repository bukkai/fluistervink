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
      <li>Alles wat je inspreekt, staat eerst op je eigen telefoon.</li>
      <li>
        Om het te verwerken gaat je opname naar OpenAI (spraak naar tekst) en de tekst naar
        Anthropic (tekst naar waarneming). Die trainen er hun modellen niet mee.
      </li>
      <li>
        Met de ontwikkelaar deel je alleen als je daar ja op zegt, en opnames alleen als je dat
        apart aanzet.
      </li>
      <li>
        Geen account, geen advertenties, geen route van waar je geweest bent. Zonder delen ziet de
        ontwikkelaar alleen hoeveel de app gebruikt wordt, niet wat je zegt of waar je bent.
      </li>
    </ul>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Wie maakt Fluistervink</h3>
    <p>
      Fluistervink is een persoonlijk project van Stephan Muller, die verantwoordelijk is voor wat
      er met je gegevens gebeurt. Vragen, inzage of iets laten wissen: mail naar
      <a href="mailto:{CONTACT}">{CONTACT}</a>, of stuur feedback in de app.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Op je telefoon</h3>
    <p>
      Opnames, tekst, tijdstip en locatie van elke uitspraak, je waarnemingen, de duur en afstand
      van een sessie en een logboek van wat de app deed staan in de opslag van de app (of de
      browser) op je telefoon, tot je ze verwijdert. Een back-up bij
      <a href="{app}#instellingen">Instellingen</a> is een bestand op je telefoon (in de Android-app in
      Downloads) dat nergens heen gaat, tenzij je het zelf ergens neerzet.
    </p>
    <p>
      In de Android-app staat tijdens een sessie een melding van Fluistervink, zodat de app met het
      scherm uit doorwerkt en je locatie blijft volgen. Bewaard wordt alleen de locatie bij het
      begin van een uitspraak, geen route, plus de afgelegde afstand als één getal. Na "Stop" houdt
      het volgen op. De gesproken bevestiging (als je die aanzet) gebruikt de voorleesfunctie van je
      telefoon; Fluistervink stuurt die tekst nergens heen.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Wat de app verstuurt</h3>
    <p>
      Alles gaat eerst langs de eigen server van Fluistervink. Die bewaart alleen wat je deelt
      (hieronder) en hoeveel je liet verwerken (aantal uitspraken en hun duur per dag en sessie,
      zonder wat je zei; dat blijft bewaard), voor de kosten en om te zien hoeveel mensen de app
      gebruiken. Het logboek van de server (wanneer, en of er iets misging) blijft een paar dagen.
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
        werkt), met hoe ver die van je af zijn. Geen opname en geen coördinaten. Anthropic wist het
        binnen 30 dagen en traint er niet mee.
      </dd>
      <dt>Waarneming.nl</dt>
      <dd>
        De coördinaten van een waarneming, om de naam van het gebied op te zoeken, via de server van
        Fluistervink (dus zonder je IP-adres of naam).
      </dd>
      <dt>OpenStreetMap</dt>
      <dd>Kaartstukjes, als je een kaart bekijkt: hun server ziet welk gebied dat is.</dd>
      <dt>Google</dt>
      <dd>
        Bij de eerste keer openen bevestigt Google Play dat het de echte app is op een echt toestel
        (Play Integrity), met een willekeurig nummer van deze installatie, zonder waarnemingen.
        Verder niets, behalve wat je zelf doet: de app uit Google Play installeren, een link naar
        een plek openen in Google Maps, of een export in Google Drive zetten.
      </dd>
      <dt>Cloudflare</dt>
      <dd>
        In de browser, of als Google Play het niet bevestigt, controleert Cloudflare Turnstile bij
        de eerste keer openen of er een echte browser achter zit, onder andere aan je IP-adres,
        volgens Cloudflare alleen om robots tegen te houden. Daarna heet je installatie bijvoorbeeld
        "app-3f9a2b1c", zonder iets wat naar jou verwijst, tenzij je bij
        <a href="{app}#instellingen">Instellingen</a> je naam invult (niet verplicht).
      </dd>
    </dl>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Delen met de ontwikkelaar</h3>
    <p>
      Zeg je ja tegen delen, dan gaan na elke sessie je uitspraken als tekst, wat de app ervan
      maakte, je correcties, je feedback, het logboek en de locaties van je waarnemingen naar de
      ontwikkelaar; opnames alleen als je dat bij <a href="{app}#instellingen">Instellingen</a>
      aanzet. Feedback die je buiten een sessie typt, gaat meteen, met het logboek van het half uur ervoor.
      Spreek geen persoonsgegevens in, zoals je naam, adres of BSN. Lange cijferreeksen (zoals een BSN,
      telefoon- of rekeningnummer) en e-mailadressen laat de app weg voor het gedeeld wordt, en de opname
      daarvan ook; op je telefoon blijven ze staan. Het staat bij Cloudflare onder de naam van je installatie.
      Alleen de ontwikkelaar leest het, om de app te verbeteren, en geeft het niet door. Het blijft tot
      je vraagt het te wissen (via feedback of <a href="mailto:{CONTACT}">{CONTACT}</a>).
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
        Alleen de opnames wissen: onderaan bij een sessie, of alles bij
        <a href="{app}#instellingen">Instellingen</a>. Tekst en waarnemingen blijven; al gedeelde
        opnames blijven bij de ontwikkelaar.
      </li>
      <li>
        Een sessie helemaal verwijderen: bij <a href="{app}#sessies">Vorige sessies</a>.
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
    <h3>Je rechten</h3>
    <p>
      Volgens de AVG mag je vragen wat er van jou bewaard is (ook een kopie van wat je deelde), en
      het laten verbeteren of wissen, of bezwaar maken: mail naar
      <a href="mailto:{CONTACT}">{CONTACT}</a>. Een klacht kan bij de
      <a href="https://autoriteitpersoonsgegevens.nl/" target="_blank" rel="noopener"
        >Autoriteit Persoonsgegevens</a
      >.
    </p>
  </div>
</section>

<p class="sources">
  Bijgewerkt op 16 november 2026. Bronnen, nagekeken op 11 november 2026:
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
