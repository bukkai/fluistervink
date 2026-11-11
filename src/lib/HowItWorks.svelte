<script lang="ts">
  // Uitleg voor testers en andere geïnteresseerden: hoe je de app gebruikt en
  // wat AI er wel en niet in doet. Kort en zonder technische termen. Houd de
  // trilpatronen gelijk met feedback.ts.
  import { isNativeApp } from './native';
</script>

<a class="back" href="#/">Terug</a>
<h2 class="page-title">Hoe werkt het?</h2>

<section class="card">
  <div class="card-body">
    <h3>Waarom Fluistervink?</h3>
    <p>
      Elke waarneming die op waarneming.nl komt, telt. Onderzoekers en natuurbeschermers gebruiken
      ze om te volgen hoe het met de vogels gaat. Zo draag je als vogelaar bij aan de wetenschap
      (citizen science).
    </p>
    <p>
      Maar alles achteraf met de hand invoeren is saai en kost veel tijd, dus blijft het vaak
      liggen. Met Fluistervink zeg je onderweg gewoon wat je ziet of hoort, en een vogelmaatje
      schrijft mee. Jij blijft kijken en luisteren; thuis staat je lijst klaar.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Inspreken</h3>
    <p>
      Tik op "Begin met vogelen". Zie of hoor je iets, tik dan op de microfoonknop onderaan (of houd
      hem vast) en zeg het zoals tegen een medevogelaar:
    </p>
    <ul class="examples">
      <li>"zes overvliegende houtduiven"</li>
      <li>"roepje vink"</li>
      <li>"schatting vijfhonderd spreeuwen"</li>
      <li>"mogelijk een woudaap" (wordt onzeker)</li>
      <li>"buizerd overvliegend, vijfhonderd meter zuid van hier"</li>
    </ul>
    <p>
      Jargon ("tova", "grobo") en wetenschappelijke namen werken ook. Meerdere soorten in één keer
      mag: "zes houtduiven en een vink" wordt twee waarnemingen. Na drie minuten stopt een opname
      vanzelf.
    </p>
    <p>
      Met een afstand én windrichting zet de app de vogel zelf op de kaart. Zeg je alleen "aan de
      overkant van de rivier", dan wordt hij onzeker en zet je hem thuis op de kaart.
    </p>
    {#if isNativeApp}
      <p>
        In de Android-app kan ook de volumeknop de opname starten en stoppen (bij Instellingen).
        Snel beginnen: houd het pictogram van Fluistervink ingedrukt en kies "Begin met vogelen".
      </p>
    {/if}
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Verbeteren</h3>
    <p>Zeg het gewoon:</p>
    <ul class="examples">
      <li>"nee, keep in plaats van vink"</li>
      <li>"nog drie erbij"</li>
      <li>"die laatste weg"</li>
      <li>"ongedaan maken"</li>
    </ul>
    <p>
      Alleen "nee, keep" voert de app uit, maar onzeker: in de wind klinkt "een keep" net zo. Thuis
      tik je op een waarneming om hem aan te passen, te kopiëren of de plek te verzetten.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Trillen</h3>
    <p>
      Zo hoef je niet op het scherm te kijken. Een heel kort tikje bij begin en eind van de opname,
      daarna:
    </p>
    <dl>
      <dt>Eén korte tril</dt>
      <dd>Opgeslagen.</dd>
      <dt>Kort, lang</dt>
      <dd>Opgeslagen, maar onzeker. Thuis even nalopen.</dd>
      <dt>Twee korte</dt>
      <dd>Niet begrepen, niets opgeslagen. Zeg het nog eens.</dd>
      <dt>Drie korte</dt>
      <dd>
        Er ging iets mis, bijvoorbeeld geen bereik. De opname is bewaard: tik later bij "Uitspraken"
        op "Opnieuw". Komt deze tril meteen na het indrukken, dan ging de microfoon niet aan.
      </dd>
    </dl>
    <p>
      Bij de trektelling: één lange tril als hij pauzeert (andere app, scherm op slot), twee lange
      als hij gestopt is. Dat gebeurt ook als je die dag al 5 uur hebt ingesproken, het maximum per
      dag.
    </p>
    {#if isNativeApp}
      <p>
        Zolang een sessie loopt, staat er een melding bovenin en werkt de app door met het scherm
        uit. Laat de knop wel eerst los: scherm uit tijdens het inspreken stopt de opname.
      </p>
    {:else}
      <p>
        Voel je niets? Zet trillen bij aanraken aan in de instellingen van je telefoon. De app trilt
        alleen als hij op het scherm staat; op een iPhone helemaal niet.
      </p>
    {/if}
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Thuis</h3>
    <p>
      Na "Stop" staan de onzekere waarnemingen bovenaan, één voor één, met de opname erbij. Daarna
      zet "Alles klopt" de sessie klaar. Bij Sessies exporteer je alles wat klaarstaat in één
      bestand voor waarneming.nl.
    </p>
    <p>Alles staat alleen op je telefoon: maak af en toe een back-up bij Instellingen.</p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Feedback geven</h3>
    <p>
      Begin een uitspraak met <em>"feedback"</em>: dan wordt het een opmerking voor de ontwikkelaar
      in plaats van een waarneming. Terug te lezen bij <a href="#feedback">Feedback</a>.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Wat AI doet</h3>
    <p>
      Een programma van OpenAI (de makers van ChatGPT) maakt tekst van je opname. Daarna leest
      Claude, de AI van Anthropic, wat je bedoelt. Het kiest alleen uit een vaste lijst Nederlandse
      vogels en kan dus geen soorten verzinnen. Bij twijfel, een heel zeldzame soort of een opname
      met bijna geen tekst wordt de waarneming onzeker.
    </p>
    <p>
      AI maakt fouten. Loop je waarnemingen daarom altijd na voordat je ze inzendt. En Fluistervink
      herkent geen vogels aan hun geluid (zoals Merlin): het verwerkt alleen wat jíj zegt.
    </p>
    <p>
      Wat er met je opnames en locaties gebeurt, lees je bij <a href="#privacy">Privacy</a>.
    </p>
  </div>
</section>

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

  * + p,
  * + ul {
    margin-top: 0.5rem;
  }

  ul {
    padding-left: 1.2rem;
  }

  li + li {
    margin-top: 0.3rem;
  }

  .examples {
    font-style: italic;
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
</style>
