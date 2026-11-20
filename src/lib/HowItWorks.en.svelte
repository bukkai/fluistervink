<script lang="ts">
  // Engelse versie van HowItWorks.svelte (ontwikkeloptie "English",
  // docs/plan-engels.md). Een wijziging aan de Nederlandse pagina hoort in
  // dezelfde PR ook hier. Houd de trilpatronen gelijk met feedback.ts.
  import { isNativeApp } from './native';
</script>

<a class="back" href="#/">Back</a>
<h2 class="page-title">How does it work?</h2>

<section class="card">
  <div class="card-body">
    <h3>Why Fluistervink?</h3>
    <p>
      Every observation that ends up on waarneming.nl counts. Researchers and conservationists use
      them to follow how birds are doing. That way, as a birder, you contribute to science (citizen
      science).
    </p>
    <p>
      But typing everything in by hand afterwards is dull and takes a lot of time, so it often
      doesn’t happen. With Fluistervink you just say what you see or hear as you go, and a birding
      buddy takes the notes. You keep watching and listening; at home your list is ready.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Speaking</h3>
    <p>
      Tap "Start birding". When you see or hear something, tap the microphone button at the bottom
      (or hold it) and say it as you would to a fellow birder:
    </p>
    <ul class="examples">
      <li>"six woodpigeons flying over"</li>
      <li>"chaffinch calling"</li>
      <li>"estimate five hundred starlings"</li>
      <li>"possibly a little bittern" (becomes uncertain)</li>
      <li>"willow warbler or chiffchaff" (at home you choose with one tap)</li>
      <li>"buzzard flying over, five hundred metres south of here"</li>
      <li>"two roe deer in the meadow" or "a red admiral"</li>
    </ul>
    <p>
      Scientific names work too. Several species at once is fine: "six woodpigeons and a chaffinch"
      becomes two observations. A recording stops by itself after three minutes. Besides birds you
      can also log mammals, reptiles and amphibians, butterflies and dragonflies; if you only want
      birds, switch that off in Settings.
    </p>
    <p>
      With a distance and a compass direction, the app puts the bird on the map itself. If you only
      say "on the other side of the river", it becomes uncertain and you place it on the map at
      home.
    </p>
    {#if isNativeApp}
      <p>
        In the Android app the volume button can also start and stop a recording (you can switch
        that off in Settings). With earbuds in, the app can also say what it logged after the buzz
        (a trial, switch it on in Settings). Quick start: press and hold the Fluistervink icon and
        choose "Start birding".
      </p>
    {/if}
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Corrections</h3>
    <p>Just say it:</p>
    <ul class="examples">
      <li>"no, brambling instead of chaffinch"</li>
      <li>"three more"</li>
      <li>"delete the last one"</li>
      <li>"undo"</li>
    </ul>
    <p>At home, tap an observation to edit it, copy it or move its location.</p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Buzzes</h3>
    <p>
      So you don’t have to look at the screen. A very short tap at the start and end of the
      recording, then:
    </p>
    <dl>
      <dt>One short buzz</dt>
      <dd>Saved.</dd>
      <dt>Short, long</dt>
      <dd>Saved, but uncertain. Check it at home.</dd>
      <dt>Two short</dt>
      <dd>Not understood, nothing saved. Say it again.</dd>
      <dt>Long, short</dt>
      <dd>
        Kept, but there’s no signal. Just keep birding: as soon as there’s a connection again, the
        app processes everything by itself, in the order you said it. Even "no, brambling" still
        works then. If you had to wait more than a minute, you get one short buzz once everything is
        in, not one per observation.
      </dd>
      <dt>Three short</dt>
      <dd>
        Something went wrong that waiting won’t fix. The recording is kept: later, tap "Retry" under
        "Voice notes". If this buzz comes right after pressing, the microphone didn’t switch on.
      </dd>
    </dl>
    <p>
      During a migration count: one long buzz when it pauses (another app, screen locked, earbuds
      out), two long when it has stopped. That also happens when you’ve already spoken for 5 hours
      that day, the daily maximum, or when the microphone won’t switch on any more; the screen then
      says why. Without signal it simply keeps counting; after 2 hours without signal you also get
      two long buzzes, but then the count carries on.
    </p>
    {#if isNativeApp}
      <p>
        While a session is running, there’s a notification at the top and the app keeps working with
        the screen off. Do let go of the button first: turning the screen off while speaking stops
        the recording.
      </p>
    {:else}
      <p>
        Feel nothing? Switch on touch vibration in your phone’s settings. The app only buzzes while
        it’s on screen; on an iPhone not at all.
      </p>
    {/if}
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>At home</h3>
    <p>
      After "Stop", the uncertain observations are at the top, one by one, with the recording. What
      the app didn’t understand is there too, with the recording: if there was a bird in it after
      all, turn it into an observation with one tap and choose the species. What you corrected by
      voice along the way is marked "Changed by voice", with what it was before: so you can see
      whether the correction landed on the right observation. Then "All correct" gets the session
      ready. Under Sessions you export everything that’s ready in one file for waarneming.nl.
    </p>
    <p>
      Do you use eBird too? Then switch on "I use eBird" in Settings. After stopping, the app asks
      whether you recorded everything you could identify, and the session gets a card for exporting
      it as a checklist, with the duration and distance. Under Sessions you export all reviewed
      sessions in one file for eBird.
    </p>
    <p>Everything is only on your phone: make a backup in Settings now and then.</p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>Giving feedback</h3>
    <p>
      Noticed something about the app? Type it under <a href="#feedback">Feedback</a>: the developer
      will read it.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-body">
    <h3>What AI does</h3>
    <p>
      A program from OpenAI (the makers of ChatGPT) turns your recording into text. Then Claude, the
      AI from Anthropic, works out what you mean. It only picks from a fixed list of species found
      in the Netherlands (birds, and other animals if you have that switched on), so it can’t make
      up species. When in doubt, for a very rare species, or for a recording with hardly any words,
      the observation becomes uncertain.
    </p>
    <p>
      AI makes mistakes. So always review your observations before you submit them. And Fluistervink
      doesn’t identify birds by their sound (like Merlin does): it only processes what
      <em>you</em> say.
    </p>
    <p>
      What happens to your recordings and locations is explained under
      <a href="#privacy">Privacy</a>.
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
