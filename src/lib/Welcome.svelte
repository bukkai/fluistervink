<script lang="ts">
  // Welkom voor nieuwelingen op het hoofdscherm, tot de eerste sessie of tot
  // "Begrepen". Zie welcome.ts. Houd de trilpatronen gelijk met HowItWorks.
  import { isNativeApp } from './native';
  import { askPermissions, setWelcomeDone, type PermissionResult } from './welcome';

  let { onclose }: { onclose: () => void } = $props();

  let asking = $state(false);
  let permissions = $state<PermissionResult>();

  async function ask() {
    asking = true;
    permissions = await askPermissions();
    asking = false;
  }

  function close() {
    setWelcomeDone();
    onclose();
  }

  const settingsPath = isNativeApp
    ? 'Instellingen van je telefoon → Apps → Fluistervink → Rechten'
    : 'Chrome: tik op het icoontje links van het adres → Rechten';
</script>

<section class="welcome card" aria-labelledby="welcome-title">
  <h2 id="welcome-title">Welkom bij Fluistervink</h2>
  <p>Je eerste sessie, in vier stappen:</p>
  <ol>
    <li>
      Tik op <strong>Begin met vogelen</strong>. De app onthoudt waar je bent, zodat elke waarneming
      op de goede plek komt.{#if isNativeApp}
        Er verschijnt een melding van Fluistervink; daardoor werkt de app door als je telefoon in je
        zak zit.{/if}
    </li>
    <li>
      Zie of hoor je iets? Tik op de <strong>microfoonknop</strong> onderaan (of houd hem vast) en
      zeg het gewoon: <em>"drie merels"</em>, <em>"roepje vink"</em>.
    </li>
    <li>
      Voel je <strong>één korte tril</strong>, dan is het opgeslagen. Twee korte: niet begrepen, zeg
      het nog eens.
    </li>
    <li>
      Klaar? Tik op <strong>Stop</strong>. Thuis loop je de lijst na en zet je hem klaar voor
      waarneming.nl.
    </li>
  </ol>

  <p class="hint">
    Je telefoon vraagt de eerste keer of de app je microfoon en locatie mag gebruiken. Geef dat
    alvast, dan komt die vraag niet midden in je eerste waarneming.
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
        kaart. Aanzetten kan alsnog bij {settingsPath}.
      </p>
    {/if}
  {:else}
    <button class="btn block" disabled={asking} onclick={ask}>
      {asking ? 'Even wachten…' : 'Toestemming geven'}
    </button>
  {/if}

  <div class="actions">
    <a class="link" href="#uitleg">Meer uitleg</a>
    <button class="btn secondary" onclick={close}>Begrepen</button>
  </div>
</section>

<style>
  .welcome {
    display: grid;
    gap: 0.75rem;
    padding: 1rem;
    text-align: left;
  }

  h2 {
    margin: 0;
    font-size: 1.15rem;
  }

  p,
  ol,
  ul {
    margin: 0;
  }

  ol {
    display: grid;
    gap: 0.5rem;
    padding-left: 1.25rem;
  }

  .hint {
    font-size: 0.9rem;
    color: var(--muted);
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

  .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
</style>
