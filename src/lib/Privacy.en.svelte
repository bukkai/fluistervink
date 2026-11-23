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
      <li>Everything you say is stored on your own phone first.</li>
      <li>
        To process it, your recording goes to OpenAI (speech to text) and the text to Anthropic
        (text to observation). They don’t train their models on it.
      </li>
      <li>
        You only share with the developer if you say yes to that, and recordings only if you switch
        that on separately.
      </li>
      <li>
        No account, no ads, no track of where you’ve been. Without sharing, the developer only sees
        how much the app is used, not what you say or where you are.
      </li>
    </ul>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Who makes Fluistervink</h3>
    <p>
      Fluistervink is a personal project of Stephan Muller, who is responsible for what happens to
      your data. Questions, access to your data or having something erased: email
      <a href="mailto:{CONTACT}">{CONTACT}</a>, or send feedback in the app.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>On your phone</h3>
    <p>
      Recordings, text, time and location of each voice note, your observations, the duration and
      distance of a session and a log of what the app did are kept in the storage of the app (or the
      browser) on your phone, until you delete them. A backup under
      <a href="{app}#instellingen">Settings</a> is a file on your phone (in the Android app in Downloads)
      that goes nowhere, unless you put it somewhere yourself.
    </p>
    <p>
      In the Android app, Fluistervink shows a notification during a session, so the app keeps
      working with the screen off and keeps following your location. Only the location at the start
      of a voice note is kept, no track, plus the distance walked as a single number. After "Stop"
      the following ends. The spoken confirmation (if you switch it on) uses your phone’s
      text-to-speech; Fluistervink doesn’t send that text anywhere.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>What the app sends</h3>
    <p>
      Everything first passes through Fluistervink’s own server. It only keeps what you share
      (below) and how much you had processed (number of voice notes and their duration per day and
      session, without what you said; for 13 months, after that only as a weekly total that no
      longer shows whose it was), for the costs and to see how many people use the app. The server’s
      log (when, and whether something went wrong) is kept for a few days.
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
        more" works), with how far they are from you. No recording and no coordinates. Anthropic
        deletes it within 30 days and doesn’t train on it.
      </dd>
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
        In the browser, or if Google Play doesn’t confirm it, Cloudflare Turnstile checks the first
        time you open the app whether there’s a real browser behind it, among other things from your
        IP address, according to Cloudflare only to keep robots out. After that your installation is
        called something like "app-3f9a2b1c", with nothing that points to you, unless you fill in
        your name under <a href="{app}#instellingen">Settings</a> (optional).
      </dd>
    </dl>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Sharing with the developer</h3>
    <p>
      If you say yes to sharing, then after each session your voice notes as text, what the app made
      of them, your corrections, your feedback, the log and the locations of your observations go to
      the developer; recordings only if you switch that on under
      <a href="{app}#instellingen">Settings</a>. Feedback you type outside a session goes straight
      away, with the log of the half hour before. Please don’t say any personal details, such as
      your name, address or social security number. The app leaves out long strings of digits (such
      as an ID, phone or bank account number) and email addresses before sharing, and the recording
      of what you said too; they stay on your phone. It is stored at Cloudflare under the name of
      your installation. Only the developer reads it, to improve the app, and doesn’t pass it on. It
      is kept until you ask for it to be erased (via feedback or
      <a href="mailto:{CONTACT}">{CONTACT}</a>).
    </p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>What you can do yourself</h3>
    <ul>
      <li>
        Switch sharing on or off, with or without recordings: <a href="{app}#instellingen"
          >Settings</a
        >.
      </li>
      <li>
        Delete only the recordings: at the bottom of a session, or all of them under
        <a href="{app}#instellingen">Settings</a>. Text and observations stay; recordings already
        shared stay with the developer.
      </li>
      <li>
        Delete a session completely: under <a href="{app}#sessies">Sessions</a>.
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
    <h3>Your rights</h3>
    <p>
      Under the GDPR you may ask what is stored about you (including a copy of what you shared),
      have it corrected or erased, or object: email
      <a href="mailto:{CONTACT}">{CONTACT}</a>. You can lodge a complaint with the Dutch data
      protection authority, the
      <a href="https://autoriteitpersoonsgegevens.nl/" target="_blank" rel="noopener"
        >Autoriteit Persoonsgegevens</a
      >.
    </p>
  </div>
</section>

<p class="sources">
  Updated on 16 November 2026. Sources, checked on 11 November 2026:
  <a href="https://developers.openai.com/api/docs/guides/your-data" target="_blank" rel="noopener"
    >OpenAI</a
  >,
  <a
    href="https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data"
    target="_blank"
    rel="noopener">Anthropic (retention)</a
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
