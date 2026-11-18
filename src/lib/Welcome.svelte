<script lang="ts">
  // Welkom voor nieuwelingen, in plaats van het hoofdscherm, tot de eerste
  // sessie of tot het einde (of Overslaan). De stappen: wat is het,
  // toestemming voor microfoon en locatie, één zin proberen (TryOut, als de
  // browser kan opnemen), en de vraag over delen (alleen als die nog open
  // staat). Zie welcome.ts. Houd de trilpatronen gelijk met HowItWorks.
  import { tick, untrack } from 'svelte';
  import { isNativeApp } from './native';
  import { recorder } from './recorder.svelte';
  import TryOut from './TryOut.svelte';
  import {
    askPermissions,
    permissionSettingsPath,
    setWelcomeDone,
    type PermissionResult,
  } from './welcome';

  let {
    askShare,
    onshare,
    onclose,
  }: {
    /** De vraag over delen staat nog open: dan een laatste stap */
    askShare: boolean;
    onshare: (on: boolean) => void;
    onclose: () => void;
  } = $props();

  // Bij het begin vastgelegd: de stappen veranderen niet als de keuze over
  // delen halverwege valt
  type Step = 'welkom' | 'toestemming' | 'proberen' | 'delen';
  const steps: Step[] = [
    'welkom',
    'toestemming',
    ...(recorder.status === 'unsupported' ? [] : ['proberen' as const]),
    ...(untrack(() => askShare) ? ['delen' as const] : []),
  ];
  let index = $state(0);
  let step = $derived(steps[index]);
  let last = $derived(index === steps.length - 1);
  let heading = $state<HTMLHeadingElement>();

  let asking = $state(false);
  let permissions = $state<PermissionResult>();

  async function next() {
    if (last) return close();
    index++;
    // Schermlezer en toetsenbord naar de nieuwe stap
    await tick();
    heading?.focus();
  }

  async function ask() {
    asking = true;
    permissions = await askPermissions();
    asking = false;
  }

  function share(on: boolean) {
    onshare(on);
    close();
  }

  function close() {
    setWelcomeDone();
    onclose();
  }
</script>

<section class="welcome" aria-labelledby="welcome-title">
  {#if step === 'welkom'}
    <img class="hero" src="/icon.svg" alt="" width="112" height="112" />
    <h1 id="welcome-title" tabindex="-1" bind:this={heading}>Welkom bij Fluistervink</h1>
    <p class="lead">
      Zeg onderweg wat je ziet of hoort. Fluistervink schrijft mee, zodat jij kunt blijven kijken en
      luisteren.
    </p>
    <ul class="how">
      <li>
        <span class="icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"
            ><path
              d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 9a7 7 0 0 0 14 0M12 19v2"
            /></svg
          >
        </span>
        <span>Druk op de knop en zeg het gewoon: <em>"drie merels"</em></span>
      </li>
      <li>
        <span class="icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"
            ><rect x="8" y="3" width="8" height="18" rx="2" /><path
              d="M4 8v8M20 8v8M1.5 10v4M22.5 10v4"
            /></svg
          >
        </span>
        <span>Eén korte tril: opgeslagen. Je hoeft niet naar het scherm te kijken.</span>
      </li>
      <li>
        <span class="icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M3 11 12 4l9 7M5.5 9.5V20h13V9.5M10 20v-5h4v5" /></svg>
        </span>
        <span>Thuis loop je de lijst na en zet je hem door naar waarneming.nl.</span>
      </li>
    </ul>
  {:else if step === 'toestemming'}
    <h1 id="welcome-title" tabindex="-1" bind:this={heading}>Microfoon en locatie</h1>
    <p class="lead">
      Je telefoon vraagt de eerste keer of de app je <strong>microfoon</strong> en
      <strong>locatie</strong> mag gebruiken. Geef dat nu alvast, dan komt die vraag niet midden in je
      eerste waarneming.
    </p>
    <p class="hint">
      De microfoon staat alleen aan als jij op de knop drukt. De locatie zorgt dat elke waarneming
      op de goede plek komt.{#if isNativeApp}
        Tijdens het vogelen staat er een melding van Fluistervink; daardoor werkt de app door als je
        telefoon in je zak zit.{/if}
    </p>
    {#if permissions}
      <ul class="permissions" role="status">
        <li class:no={!permissions.microphone}>
          Microfoon: {permissions.microphone ? 'in orde' : 'geen toestemming'}
        </li>
        <li class:no={!permissions.location}>
          Locatie: {permissions.location ? 'in orde' : 'geen toestemming'}
        </li>
      </ul>
      {#if !permissions.microphone || !permissions.location}
        <p class="hint">
          Zonder microfoon kun je niets inspreken, zonder locatie komen je waarnemingen niet op de
          kaart. Aanzetten kan alsnog bij {permissionSettingsPath}.
        </p>
      {/if}
    {/if}
  {:else if step === 'proberen'}
    <h1 id="welcome-title" tabindex="-1" bind:this={heading}>Probeer het eens</h1>
    <p class="lead">
      Zeg iets alsof je buiten staat, bijvoorbeeld <em>"drie merels en een zingende roodborst"</em>.
      Er wordt niets bewaard.
    </p>
    <TryOut />
  {:else}
    <h1 id="welcome-title" tabindex="-1" bind:this={heading}>Help je mee?</h1>
    <p class="lead">
      Fluistervink is nog in ontwikkeling, en het werk van één ontwikkelaar, Stephan. Wat jij
      inspreekt en verbetert, laat zien waar de app nog misgaat.
    </p>
    <p class="hint detail">
      Mag de app na elke sessie je uitspraken (als tekst), wat de app ervan maakte, je correcties en
      feedback, en de locaties van je waarnemingen naar de ontwikkelaar sturen? Opnames niet, tenzij
      je dat bij Instellingen aanzet. Alleen de ontwikkelaar kan het lezen, en je kunt het altijd
      weer uitzetten. <a href="#privacy">Meer over privacy</a>
    </p>
  {/if}

  <div class="footer">
    {#if step === 'toestemming' && !permissions}
      <button class="btn block large" disabled={asking} onclick={ask}>
        {asking ? 'Even wachten…' : 'Toestemming geven'}
      </button>
      <button class="link" onclick={next}>Later</button>
    {:else if step === 'delen'}
      <button class="btn block large" onclick={() => share(true)}>Ja, delen</button>
      <button class="link" onclick={() => share(false)}>Liever niet</button>
    {:else}
      <button class="btn block large" class:secondary={step === 'proberen'} onclick={next}>
        {last ? 'Aan de slag' : 'Verder'}
      </button>
      {#if step === 'welkom'}
        <button class="link" onclick={close}>Overslaan</button>
      {/if}
    {/if}
    <p class="dots" aria-label="Stap {index + 1} van {steps.length}">
      {#each steps as name, i (name)}
        <span class:on={i === index}></span>
      {/each}
    </p>
  </div>
</section>

<style>
  .welcome {
    display: grid;
    justify-items: center;
    gap: 1rem;
    margin-top: 2rem;
    text-align: center;
  }

  .hero {
    border-radius: 1.75rem;
    box-shadow: 0 8px 24px rgb(60 55 50 / 0.18);
  }

  h1 {
    margin: 0.5rem 0 0;
    font-size: 1.6rem;
    line-height: 1.2;
    letter-spacing: -0.01em;
  }

  h1:focus {
    outline: none;
  }

  p,
  ul {
    margin: 0;
  }

  .lead {
    max-width: 24rem;
    font-size: 1.05rem;
  }

  .hint {
    max-width: 24rem;
    font-size: 0.95rem;
    color: var(--muted);
  }

  .detail {
    text-align: left;
  }

  .hint a {
    color: inherit;
  }

  .how {
    display: grid;
    gap: 0.9rem;
    width: 100%;
    max-width: 24rem;
    margin-top: 0.5rem;
    padding: 0;
    list-style: none;
    text-align: left;
  }

  .how li {
    display: flex;
    align-items: center;
    gap: 0.9rem;
  }

  .icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 50%;
    background: var(--surface);
    box-shadow: inset 0 0 0 1px var(--border);
  }

  .icon svg {
    width: 1.4rem;
    height: 1.4rem;
    fill: none;
    stroke: var(--brand-strong);
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .permissions {
    padding: 0;
    list-style: none;
    font-weight: 600;
    color: var(--brand-strong);
  }

  .permissions .no {
    color: var(--red);
  }

  .footer {
    display: grid;
    justify-items: center;
    gap: 0.75rem;
    width: 100%;
    margin-top: 1rem;
  }

  .footer .link {
    padding: 0.5rem 1rem;
  }

  .dots {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .dots span {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--border);
  }

  .dots .on {
    background: var(--brand);
  }
</style>
