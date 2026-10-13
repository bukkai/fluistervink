<script lang="ts">
  // Uitleg voor testers en andere geïnteresseerden: hoe je de app gebruikt en
  // wat AI er wel en niet in doet. Kort en zonder technische termen. Houd de
  // trilpatronen gelijk met feedback.ts.
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
      Start een wandeling. Zie of hoor je iets, tik dan op de microfoonknop of houd hem vast, en zeg
      wat je waarneemt. Gewoon zoals je het tegen een medevogelaar zou zeggen:
    </p>
    <ul class="examples">
      <li>"zes overvliegende houtduiven"</li>
      <li>"roepje vink"</li>
      <li>"schatting vijfhonderd spreeuwen"</li>
      <li>"vijf wilde eenden, twee vrouwtjes en drie mannetjes"</li>
      <li>"mogelijk een woudaap" (wordt onzeker)</li>
    </ul>
    <p>Vogelaarsjargon werkt ook: "tova", "KBV", "grobo".</p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Verbeteren</h3>
    <p>Iets verkeerd verstaan of verkeerd gezegd? Zeg het gewoon:</p>
    <ul class="examples">
      <li>"nee, keep in plaats van vink"</li>
      <li>"nog drie erbij"</li>
      <li>"die laatste weg"</li>
    </ul>
    <p>Thuis kun je alles nalopen en aanpassen door op een waarneming te tikken.</p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Trillen</h3>
    <p>
      Zo hoef je onderweg niet op je scherm te kijken. Bij het begin en eind van een opname voel je
      een heel kort tikje, daarna hoor je via een tril of het gelukt is:
    </p>
    <dl>
      <dt>Eén korte tril</dt>
      <dd>Opgeslagen.</dd>
      <dt>Kort, lang</dt>
      <dd>Opgeslagen, maar onzeker. Even nalopen als je thuis bent.</dd>
      <dt>Twee korte</dt>
      <dd>Niet begrepen, er is niets opgeslagen. Zeg het nog eens.</dd>
      <dt>Drie korte</dt>
      <dd>
        Er ging iets mis, bijvoorbeeld geen bereik. De opname is bewaard en gaat niet verloren, maar
        wordt niet vanzelf opnieuw verwerkt: tik later, als je weer bereik hebt, bij de wandeling
        onder "Uitspraken" op "Opnieuw". Bij heel slecht bereik kan deze tril tot een halve minuut
        op zich laten wachten.
      </dd>
    </dl>
    <p>
      Voel je niets? Zet dan in de instellingen van je telefoon trillen bij aanraken aan (bij een
      Engelse telefoon: Sound and vibration → Vibration and haptics → Touch feedback). De app trilt
      alleen als hij op je scherm staat, niet met het scherm uit of als je een andere app open hebt.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Thuis</h3>
    <p>
      Na "Stop" zie je de wandeling op een kaart en in een lijst. Loop de onzekere waarnemingen na,
      luister zo nodig de opname terug, en zet de wandeling klaar voor waarneming.nl. Wanneer het je
      uitkomt, exporteer je alle klaarstaande wandelingen in één bestand (bij Wandelingen) en
      importeer je dat bij waarneming.nl.
    </p>
    <p>
      Vergeten op Stop te drukken? Heb je een uur niets ingesproken, dan vraagt de app bij het
      openen of de wandeling nog loopt. Na 8 uur stopt hij vanzelf.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Feedback geven</h3>
    <p>
      Begin een uitspraak met <em>"feedback"</em>, bijvoorbeeld
      <em>"feedback, hij herkende blako niet, terwijl dat toch echt bladkoning betekent"</em>. Dat
      wordt geen waarneming, maar een opmerking voor de ontwikkelaar. Terug te lezen bij
      <a href="#feedback">Feedback</a>.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Wat er gebeurt als je iets zegt</h3>
    <ol>
      <li>
        <strong>De app</strong> noteert het tijdstip en waar je bent, en bewaart je opname op je telefoon.
      </li>
      <li>
        <strong>Spraak wordt tekst.</strong> Een programma van OpenAI (de makers van ChatGPT) schrijft
        uit wat je zei. Het krijgt een lijst vogelnamen mee, zodat "tjiftjaf" goed overkomt.
      </li>
      <li>
        <strong>Tekst wordt een waarneming.</strong> Claude, de AI van Anthropic (een kleine, snelle versie),
        leest de zin en bepaalt wat je bedoelt: een nieuwe waarneming, een verbetering, of iets weghalen.
        Het mag alleen kiezen uit een vaste lijst Nederlandse vogelsoorten en kan dus geen soorten verzinnen.
        Twijfelt het, dan markeert het de waarneming als onzeker in plaats van te gokken.
      </li>
      <li>
        <strong>De app</strong> controleert het resultaat, slaat het op, zoekt de naam van het gebied
        op bij waarneming.nl, en trilt. Een lange opname met bijna geen tekst (knop per ongeluk aangezet
        in je zak) wordt onzeker: uit geritsel verzint de spraakherkenning soms een vogel.
      </li>
    </ol>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Wat AI niet kan</h3>
    <ul>
      <li>
        AI maakt fouten: verkeerd verstaan, een verkeerde soort, een verkeerd aantal. Loop je
        waarnemingen daarom altijd na voordat je ze inzendt. Wat er op waarneming.nl komt, blijft
        jouw verantwoordelijkheid.
      </li>
      <li>
        Fluistervink herkent geen vogels aan hun geluid (dat doen apps als Merlin en BirdNET). Het
        verwerkt alleen wat jíj zegt.
      </li>
    </ul>
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
  ol,
  dl {
    margin: 0;
  }

  * + p,
  * + ul,
  * + ol {
    margin-top: 0.5rem;
  }

  ul,
  ol {
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
