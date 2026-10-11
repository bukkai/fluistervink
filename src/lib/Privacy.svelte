<script lang="ts">
  // Wat er met opnames, locaties en waarnemingen gebeurt. Houd dit gelijk met
  // de code: elke nieuwe plek waar gegevens heen gaan, hoort hier te staan.
  // Het beleid van de aanbieders verandert; de bronnen onderaan zijn nagekeken
  // op de datum die erbij staat.
</script>

<a class="back" href="#/">Terug</a>
<h2 class="page-title">Privacy</h2>

<section class="card">
  <div class="card-body">
    <h3>Kort gezegd</h3>
    <ul>
      <li>Alles wat je inspreekt, staat eerst op je eigen telefoon.</li>
      <li>
        Voor het verwerken gaat je opname naar OpenAI (spraak naar tekst) en de tekst naar
        Anthropic (tekst naar waarneming). Die gebruiken het niet om hun modellen te trainen.
      </li>
      <li>
        Delen met de ontwikkelaar doe je alleen als je daar ja op zegt, en opnames alleen als je
        dat apart aanzet.
      </li>
      <li>Geen account, geen advertenties, geen statistieken, geen route van je wandeling.</li>
    </ul>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Op je telefoon</h3>
    <p>
      De opname van elke uitspraak, de tekst, het tijdstip, de locatie (alleen op het moment dat je
      begint met inspreken), je waarnemingen en een logboek van wat de app deed (fouten, wachttijden)
      staan in de opslag van de browser op je telefoon. Daar blijven ze tot je ze verwijdert.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Wat de app verstuurt</h3>
    <p>
      Alles gaat eerst langs de eigen server van Fluistervink. Die bewaart niets, behalve wat je
      deelt (hieronder). Wel houdt hij een paar dagen bij wanneer je de app gebruikte en of er iets
      misging.
    </p>
    <dl>
      <dt>OpenAI</dt>
      <dd>
        De opname van een uitspraak, met een lijst vogelnamen, om er tekst van te maken. Volgens
        OpenAI wordt dit niet bewaard en niet gebruikt voor training.
      </dd>
      <dt>Anthropic</dt>
      <dd>
        De tekst van je uitspraak plus de laatste waarnemingen van de wandeling (zodat "nog drie
        erbij" werkt). Geen opname, geen locatie. Anthropic wist dit binnen 30 dagen en gebruikt
        het niet voor training.
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
    </dl>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Delen met de ontwikkelaar</h3>
    <p>
      Fluistervink is nog in ontwikkeling. Zeg je ja tegen delen, dan gaan na elke wandeling je
      uitspraken als tekst, wat de app ervan maakte, je correcties bij het nalopen, je feedback,
      het logboek van die wandeling en de locaties van je waarnemingen naar de ontwikkelaar.
      Opnames alleen als je dat bij <a href="#feedback">Feedback</a> aanzet.
    </p>
    <p>
      Het staat bij Cloudflare onder je testernaam. Alleen de ontwikkelaar kan het lezen, en
      gebruikt het alleen om de herkenning en de app te verbeteren. Niet doorgeven, niet
      publiceren. Wil je dat het weg is, vraag het aan wie je heeft uitgenodigd: dan wordt alles
      van jou gewist.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Wat je zelf kunt doen</h3>
    <ul>
      <li>Delen aan- of uitzetten, met of zonder opnames: <a href="#feedback">Feedback</a>.</li>
      <li>
        Een wandeling verwijderen, met alle opnames: bij <a href="#wandelingen">Vorige wandelingen</a>.
        Dat is echt weg.
      </li>
      <li>Een kopie van al je gegevens: vraag het aan wie je heeft uitgenodigd.</li>
      <li>
        Alles wissen: de app verwijderen, of in Chrome de sitegegevens van Fluistervink wissen.
      </li>
      <li>
        Naar waarneming.nl gaat alleen wat je zelf exporteert en daar importeert (zonder opnames).
      </li>
    </ul>
  </div>
</section>

<p class="sources">
  Bronnen, nagekeken op 11 oktober 2026:
  <a href="https://developers.openai.com/api/docs/guides/your-data" target="_blank" rel="noopener">OpenAI</a>,
  <a
    href="https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data"
    target="_blank"
    rel="noopener">Anthropic (bewaren)</a>,
  <a
    href="https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training"
    target="_blank"
    rel="noopener">Anthropic (training)</a>,
  <a href="https://developers.cloudflare.com/workers/observability/logs/workers-logs/" target="_blank" rel="noopener">Cloudflare</a>.
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
