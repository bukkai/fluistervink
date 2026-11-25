<script module lang="ts">
  // Blijft staan als je het startscherm verlaat en terugkomt, tot de app opnieuw opent
  const later = $state({ move: false });
</script>

<script lang="ts">
  import { t } from './i18n';
  import { dayFormat, formatMoment } from './format';
  import type { Session } from './db';
  import { liveQuery } from 'dexie';
  import { exportContent, exportReminder, reminderText, snooze, snoozedAt } from './exportReminder';
  import { CHANNEL } from './log';
  import { isAndroidApp } from './native';
  import { preferenceOn } from './preferences';
  import type { StaleCheck } from './sessions';
  import { dismissTelweekendNotice, showTelweekendNotice } from './tuintelling';
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
    /** Tuintelling starten (ontwikkeloptie of rond het telweekend, tuintelling.ts) */
    onstarttuintel?: () => void;
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
    onstarttuintel,
  }: Props = $props();

  let last = $derived(sessions.find((s) => s.status === 'ended'));

  // In het telweekend een melding met de knop erin, in plaats van de losse knop
  let noticeGone = $state(false);
  let telweekend = $derived(
    !noticeGone && showTelweekendNotice(now, onstarttuintel !== undefined, sessions),
  );
  function dismissTelweekend() {
    dismissTelweekendNotice();
    noticeGone = true;
  }

  // Na het welkom, tot de eerste sessie: een tip onder de startknop
  let firstTime = $derived(sessions.length === 0);

  // Wie de beta-app uit Play heeft (interne test), vragen over te stappen naar
  // de gewone app (MoveToStable.svelte). De eigenaar blijft op de beta.
  let askMove = $derived(CHANNEL === 'beta' && isAndroidApp && !isOwner && !later.move);

  // Herinnering aan de export (instelling, standaard aan; exportReminder.ts)
  let snoozed = $state(snoozedAt());
  const content = liveQuery(exportContent);
  let reminder = $derived(
    preferenceOn('exportHerinnering')
      ? exportReminder(sessions, $content, now, snoozed)
      : undefined,
  );
  function remindLater() {
    snooze();
    snoozed = Date.now();
  }
</script>

<section class="home">
  <img class="hero" src="/icon.svg" alt="" width="112" height="112" />
  <h1>{t('home.title')}</h1>
  <p class="intro">
    {t('home.introVoor')}
    <em>{t('home.introExample1')}</em>
    {t('home.introOf')} <em>{t('home.introExample2')}</em>.
  </p>
  {#if installProblem}
    <p class="notice">
      {t('home.installProblem', { problem: installProblem })}
    </p>
  {/if}
  {#if askMove}
    <MoveToStable onlater={() => (later.move = true)} />
  {/if}
  {#if stale?.kind === 'stopped'}
    <p class="welcome">
      {t('home.staleStopped', { moment: formatMoment(stale.session.startedAt) })}
      <a href="#sessie/{stale.session.id}">{t('home.view')}</a> ·
      <button class="link" onclick={ondismissstale}>{t('common.ok')}</button>
    </p>
  {/if}
  {#if reminder}
    <p class="welcome">
      {reminderText(reminder)}
      <a href="#sessies">{t('home.toSessions')}</a> ·
      <button class="link" onclick={remindLater}>{t('common.later')}</button>
    </p>
  {/if}
  {#if telweekend}
    <div class="telweekend card">
      <strong>{t('home.telweekendTitle')}</strong>
      <p>{t('home.telweekendText')}</p>
      <button class="btn block" onclick={onstarttuintel}>{t('home.telweekendStart')}</button>
      <button class="link" onclick={dismissTelweekend}>{t('common.later')}</button>
    </div>
  {/if}
  {#if askShare && !installProblem}
    <div class="consent card">
      <strong>{t('home.shareTitle')}</strong>
      <p>
        {t('home.shareText')}
        <a href="#privacy">{t('home.privacyLink')}</a>
      </p>
      <div class="consent-buttons">
        <button class="btn" onclick={() => onshare(true)}>{t('home.shareYes')}</button>
        <button class="btn secondary" onclick={() => onshare(false)}>{t('home.shareNo')}</button>
      </div>
    </div>
  {/if}
  <button class="start" onclick={onstart}>{t('home.start')}</button>
  {#if onstarttuintel && !telweekend}
    <button class="btn secondary block large" onclick={onstarttuintel}>
      {t('home.startTuintel')}
    </button>
  {/if}
  {#if firstTime}
    <p class="tip">
      {t('home.tip')}
      <a href="#uitleg">{t('menu.howItWorks')}</a>
    </p>
  {/if}
  {#if last}
    <a class="last card" href="#sessie/{last.id}">
      <span>
        <span class="muted">{t('home.lastSession')}</span><br />
        <strong>{last.place?.name ?? t('common.defaultSessionName')}</strong>
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

  .telweekend {
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    box-sizing: border-box;
    width: 100%;
    padding: 0.9rem 1rem;
    text-align: center;
  }

  .telweekend p {
    margin: 0;
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
