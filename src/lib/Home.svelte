<script module lang="ts">
  // Blijft staan als je het startscherm verlaat en terugkomt, tot de app opnieuw opent
  const later = $state({ move: false });
</script>

<script lang="ts">
  import { dayFormat, formatMoment } from './format';
  import type { Session } from './db';
  import { exportReminder, reminderText, snooze, snoozedAt } from './exportReminder';
  import { CHANNEL } from './log';
  import { isNativeApp } from './native';
  import { preferenceOn } from './preferences';
  import type { StaleCheck } from './sessions';
  import MoveToStable from './MoveToStable.svelte';

  // Startscherm als er geen sessie loopt: de startknop, met daarboven wat er
  // eerst gezegd moet worden (aanmelden mislukt, overstappen, vergeten sessie,
  // herinnering aan de export, toestemming om te delen) en daaronder de
  // laatste sessie.

  interface Props {
    /** Alle sessies, nieuwste eerst */
    sessions: Session[];
    now: number;
    installProblem?: string;
    isOwner: boolean;
    stale?: StaleCheck;
    ondismissstale: () => void;
    askShare: boolean;
    onshare: (on: boolean) => void;
    onstart: () => void;
  }

  let {
    sessions,
    now,
    installProblem,
    isOwner,
    stale,
    ondismissstale,
    askShare,
    onshare,
    onstart,
  }: Props = $props();

  let last = $derived(sessions.find((s) => s.status === 'ended'));

  // Na het welkom, tot de eerste sessie: een tip onder de startknop
  let firstTime = $derived(sessions.length === 0);

  // Wie de beta-app uit Play heeft (interne test), vragen over te stappen naar
  // de gewone app (MoveToStable.svelte). De eigenaar blijft op de beta.
  let askMove = $derived(CHANNEL === 'beta' && isNativeApp && !isOwner && !later.move);

  // Herinnering aan de export (instelling, standaard aan; exportReminder.ts)
  let snoozed = $state(snoozedAt());
  let reminder = $derived(
    preferenceOn('exportHerinnering') ? exportReminder(sessions, now, snoozed) : undefined,
  );
  function remindLater() {
    snooze();
    snoozed = Date.now();
  }
</script>

<section class="home">
  <img class="hero" src="/icon.svg" alt="" width="112" height="112" />
  <h1>Klaar om te gaan vogelen?</h1>
  <p class="intro">
    Waar je ook bent: lopend, op de fiets, in de vogelhut of in de tuin. Zie of hoor je iets, druk
    dan op de knop en zeg het, bijvoorbeeld
    <em>"zes overvliegende houtduiven"</em> of <em>"roepje vink"</em>.
  </p>
  {#if installProblem}
    <p class="notice">
      De app kon zich niet aanmelden ({installProblem}). Probeer het later opnieuw.
    </p>
  {/if}
  {#if askMove}
    <MoveToStable onlater={() => (later.move = true)} />
  {/if}
  {#if stale?.kind === 'stopped'}
    <p class="welcome">
      Je sessie van {formatMoment(stale.session.startedAt)} stond nog aan. Na 8 uur zonder uitspraken
      is hij vanzelf gestopt.
      <a href="#sessie/{stale.session.id}">Bekijken</a> ·
      <button class="link" onclick={ondismissstale}>Oké</button>
    </p>
  {/if}
  {#if reminder}
    <p class="welcome">
      {reminderText(reminder)}
      <a href="#sessies">Naar de sessies</a> ·
      <button class="link" onclick={remindLater}>Later</button>
    </p>
  {/if}
  {#if askShare && !installProblem}
    <div class="consent card">
      <strong>Delen met de ontwikkelaar?</strong>
      <p>
        Fluistervink is nog in ontwikkeling. Mag de app na elke sessie je uitspraken (als tekst),
        wat de app ervan maakte, je correcties en feedback, en de locaties van je waarnemingen naar
        de ontwikkelaar sturen? Opnames niet, tenzij je dat bij Instellingen aanzet. Alleen de
        ontwikkelaar kan het lezen; je kunt het altijd weer uitzetten.
        <a href="#privacy">Meer over privacy</a>
      </p>
      <div class="consent-buttons">
        <button class="btn" onclick={() => onshare(true)}>Ja, delen</button>
        <button class="btn secondary" onclick={() => onshare(false)}>Liever niet</button>
      </div>
    </div>
  {/if}
  <button class="start" onclick={onstart}>Begin met vogelen</button>
  {#if firstTime}
    <p class="tip">
      Nog nooit gedaan? Probeer het in de tuin of bij het raam: één merel is genoeg.
      <a href="#uitleg">Hoe werkt het?</a>
    </p>
  {/if}
  {#if last}
    <a class="last card" href="#sessie/{last.id}">
      <span>
        <span class="muted">Laatste sessie</span><br />
        <strong>{last.place?.name ?? 'Vogelsessie'}</strong>
        <span class="muted">· {dayFormat.format(last.startedAt)}</span>
      </span>
      <span class="chevron" aria-hidden="true">›</span>
    </a>
  {/if}
</section>

<style>
  .hero {
    border-radius: 1.75rem;
    box-shadow: 0 8px 24px rgb(60 55 50 / 0.18);
  }

  .notice {
    margin: 0;
    padding: 0.5rem 0.9rem;
    border-radius: var(--radius);
    color: var(--amber);
    background: var(--amber-soft);
  }

  .tip {
    margin: 0;
    max-width: 24rem;
    color: var(--muted);
  }

  .tip a {
    color: var(--brand-strong);
  }

  .welcome {
    margin: 0;
    padding: 0.5rem 0.9rem;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--surface);
  }

  .consent {
    display: grid;
    gap: 0.5rem;
    box-sizing: border-box;
    width: 100%;
    padding: 0.9rem 1rem;
    text-align: left;
  }

  .consent p {
    margin: 0;
  }

  .consent a {
    color: inherit;
  }

  .consent-buttons,
  .last {
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-sizing: border-box;
    width: 100%;
    margin-top: 0;
    padding: 0.75rem 1rem;
    text-align: left;
    color: inherit;
    text-decoration: none;
  }

  .chevron {
    font-size: 1.5rem;
    color: var(--muted);
  }
</style>
