<script lang="ts">
  // Engelse versie van Privacy.svelte (ontwikkeloptie "English",
  // docs/plan-engels.md). Een wijziging aan de Nederlandse pagina hoort in
  // dezelfde PR ook hier, met dezelfde datums onderaan.
  //
  // Ook als losse pagina op /privacy-en (build/privacyPage.ts). Links naar
  // schermen van de app gaan dan naar de app op /app/.
  let { standalone = false }: { standalone?: boolean } = $props();
  const app = $derived(standalone ? '/app/' : '');

  const CONTACT = 'info@fluistervink.nl';
</script>

{#if !standalone}<a class="back" href="#/">Back</a>{/if}
<h2 class="page-title">Privacy</h2>

<section class="card">
  <div class="card-body">
    <h3>In short</h3>
    <ul>
      <li>
        What you say is stored on your own phone. No account, no ads and no track of where you’ve
        been.
      </li>
      <li>
        To turn your voice into an observation, the recording goes to OpenAI and the text to
        Anthropic. They don’t train their models on it.
      </li>
      <li>
        You only share with the developer if you say yes to that. Otherwise the developer only sees
        how much the app is used and a few anonymous numbers per session, never what you said or
        where you were.
      </li>
      <li>
        You can switch sharing off yourself, and delete everything on your phone yourself. What the
        developer already has is erased when you ask.
      </li>
      <li>
        Fluistervink is a personal project of Stephan Muller, who is responsible for your data.
        Questions or having something erased: <a href="mailto:{CONTACT}">{CONTACT}</a>, or send
        feedback in the app.
      </li>
    </ul>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Processing your voice</h3>
    <p>
      Two services turn what you say into an observation. This goes through Fluistervink’s own
      server, so without your IP address or name.
    </p>
    <dl>
      <dt>OpenAI</dt>
      <dd>
        The recording of a voice note, with a list of bird names, to turn it into text. According to
        OpenAI not stored and not used for training.
      </dd>
      <dt>Anthropic</dt>
      <dd>
        The text of your voice note plus the latest observations of the session (so that "three
        more" works), with their time, your remarks and notes, and how far they are from you. No
        recording and no coordinates. Anthropic deletes it within 30 days (longer only if the law
        requires it or their systems suspect misuse, then up to two years) and doesn’t train on it.
      </dd>
    </dl>
    <p>
      During a migration or garden count the microphone stays on until you stop, and the app cuts
      the recording into pieces of about a minute. Pieces without speech are thrown away right away;
      the rest goes to OpenAI and Anthropic like any voice note, also if someone else nearby is
      talking.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Sharing with the developer</h3>
    <p>
      If you say yes to sharing, then after each session your voice notes as text, what the app made
      of them, your corrections, remarks and notes, the name of the area, your feedback, the log
      (with the kind of device and the version of Android or iOS) and the locations of your
      observations go to the developer. Recordings only if you switch that on separately under
      <a href="{app}#instellingen">Settings</a>. Feedback you type outside a session goes straight
      away, with the log of the half hour before.
    </p>
    <p>
      If you happen to say a long number (such as a phone or bank account number) or an email
      address, the app leaves it out before anything is shared, and the recording of that voice note
      too. It stays on your phone.
    </p>
    <p>
      Only the developer reads it, at Cloudflare and on the developer’s own computer, to improve the
      app. Sometimes it goes through the speech recognition and the model again, to test an
      improvement. Beyond that it goes nowhere. It is stored under the name of your installation and
      kept until you ask for it to be erased: email
      <a href="mailto:{CONTACT}">{CONTACT}</a>, or send feedback while sharing is on.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>What you can do yourself</h3>
    <ul>
      <li>
        Switch sharing on or off, with or without recordings: <a href="{app}#instellingen">
          Settings
        </a>.
      </li>
      <li>
        Switch off anonymous numbers per session: also under <a href="{app}#instellingen">
          Settings
        </a>.
      </li>
      <li>
        Delete only the recordings: at the bottom of a session, or all of them under
        <a href="{app}#instellingen">Settings</a>. Text and observations stay; recordings already
        shared stay with the developer.
      </li>
      <li>
        Delete a session completely: under <a href="{app}#sessies">Sessions</a>. A session already
        shared stays with the developer until you ask for it to be erased.
      </li>
      <li>Delete everything: uninstall the app, or clear Fluistervink’s site data in Chrome.</li>
      <li>
        Only the file you export yourself and upload there goes to waarneming.nl and eBird (without
        recordings).
      </li>
    </ul>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>All the details</h3>
    <p class="muted">For those who want to know exactly.</p>

    <details>
      <summary>What is stored on your phone</summary>
      <p>
        Recordings, text, time and location of each voice note, your observations, the duration and
        distance of a session and a log of what the app did are kept in the storage of the app (or
        the browser) on your phone, until you delete them. A backup under
        <a href="{app}#instellingen">Settings</a> is a file on your phone (in the Android app in Downloads)
        that goes nowhere, unless you put it somewhere yourself.
      </p>
      <p>
        In the Android app, Fluistervink shows a notification during a session, so the app keeps
        working with the screen off and keeps following your location. Only the location at the
        start of a voice note is kept, no track, plus the distance walked as a single number. After
        "Stop" the following ends. The spoken confirmation (if you switch it on) uses your phone’s
        text-to-speech; Fluistervink doesn’t send that text anywhere.
      </p>
    </details>

    <details>
      <summary>Fluistervink’s server</summary>
      <p>
        Everything the app sends first passes through Fluistervink’s own server. It only keeps what
        you share and how much you had processed, for the costs and to see how many people use the
        app: the number of voice notes and their duration per day and session, with the kind of
        voice note, the language and the app version, without what you said. That is kept for 13
        months, after that only as a weekly total that no longer shows whose it was. The server’s
        log (when, and whether something went wrong) is kept for a few days.
      </p>
    </details>

    <details>
      <summary>Anonymous numbers per session</summary>
      <p>
        Separately from sharing, the app sends a handful of numbers after a session: how long it
        lasted (to 5 minutes), how many voice notes, observations and different species, how many of
        those were uncertain, not understood, corrected by voice or failed, whether it waited for a
        connection, whether it was a migration or garden count, whether you reviewed and exported,
        and whether it was the Android app, an iPhone or the browser. This happens when you export
        the session, or a week after stopping. Not where, on which day, which species or what you
        said. The server stores it without your installation, only with the week in which it arrived
        and the week in which your installation started, so it can’t be traced back to you. This
        lets the developer see how well the app works in the field. On by default; switch it off
        under <a href="{app}#instellingen">Settings</a>.
      </p>
    </details>

    <details>
      <summary>Map, area name and opening the app for the first time</summary>
      <dl>
        <dt>Waarneming.nl</dt>
        <dd>
          The coordinates of an observation, to look up the name of the area, via Fluistervink’s
          server (so without your IP address or name).
        </dd>
        <dt>OpenStreetMap</dt>
        <dd>Map tiles, when you look at a map: their server sees which area that is.</dd>
        <dt>Google</dt>
        <dd>
          The first time you open the app, Google Play confirms that it’s the real app on a real
          device (Play Integrity), with a random number for this installation, without observations.
          Nothing else, except what you do yourself: installing the app from Google Play, opening a
          link to a place in Google Maps, or putting an export in Google Drive.
        </dd>
        <dt>Cloudflare</dt>
        <dd>
          In the browser, or if Google Play doesn’t confirm it, Cloudflare Turnstile checks the
          first time you open the app whether there’s a real browser behind it, among other things
          from your IP address, according to Cloudflare only to recognise and keep out robots. After
          that your installation is called something like "app-3f9a2b1c", with nothing that points
          to you, unless you fill in your name under <a href="{app}#instellingen">Settings</a> (optional).
          Every installation also notes whether it’s an iPhone, an Android device or a computer (your
          browser sends that itself), so the developer can see how many people use which kind of device;
          not the brand, model or version (those are only in the log, if you share).
        </dd>
      </dl>
    </details>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Your rights</h3>
    <p>
      Under the GDPR you may ask what is stored about you (including a copy of what you shared),
      have it corrected or erased, or object: email
      <a href="mailto:{CONTACT}">{CONTACT}</a>. You can lodge a complaint with the Dutch data
      protection authority, the
      <a href="https://autoriteitpersoonsgegevens.nl/" target="_blank" rel="noopener">
        Autoriteit Persoonsgegevens
      </a>.
    </p>
  </div>
</section>

<p class="sources">
  Updated on 25 November 2026. Sources, checked on 25 November 2026:
  <a href="https://developers.openai.com/api/docs/guides/your-data" target="_blank" rel="noopener">
    OpenAI
  </a>,
  <a
    href="https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data"
    target="_blank"
    rel="noopener"
  >
    Anthropic (retention)
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
