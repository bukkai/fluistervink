<script lang="ts">
  import { t } from './i18n';
  import { dateYearTimeFormat } from './format';
  import { getDisplayName, setDisplayName } from './api';
  // Delen met de ontwikkelaar aan/uit, met of zonder opnames, en handmatig
  // versturen. Zie share.ts; de eerste keuze vraagt het welkom (of anders het hoofdscherm).
  import {
    lastSharedAt,
    setShareAudio,
    setShareEnabled,
    shareAudio,
    shareEnabled,
    shareNow,
  } from './share';

  // De eigenaar heeft geen naam nodig: die is te herkennen aan zijn code
  let { showName = true }: { showName?: boolean } = $props();

  let sharing = $state(shareEnabled());
  let sharingAudio = $state(shareAudio());
  let sharedAt = $state(lastSharedAt());
  let shareStatus = $state<'idle' | 'busy' | 'error'>('idle');
  let shareMessage = $state('');

  // Eigen naam, zodat de ontwikkelaar weet van wie gebruik en feedback komen.
  // Los van het delen: de proxy telt het gebruik ook zonder.
  let displayName = $state(getDisplayName());
  let nameStatus = $state<'idle' | 'busy' | 'ok' | 'error'>('idle');
  let nameMessage = $state('');

  async function saveName(event: SubmitEvent) {
    event.preventDefault();
    nameStatus = 'busy';
    try {
      await setDisplayName(displayName);
      displayName = getDisplayName();
      nameStatus = 'ok';
      nameMessage = displayName ? t('settings.nameSaved') : t('settings.nameRemoved');
    } catch (error) {
      nameStatus = 'error';
      nameMessage = t('settings.saveFailed', {
        error: String(error instanceof Error ? error.message : error),
      });
    }
  }

  async function shareManually() {
    shareStatus = 'busy';
    try {
      const { sessions, audio } = await shareNow();
      shareStatus = 'idle';
      sharedAt = lastSharedAt();
      const parts = [
        sessions && t('common.sessions', { n: sessions }),
        audio && t('common.recordings', { n: audio }),
      ].filter((part): part is string => !!part);
      shareMessage = parts.length
        ? t('share.sent', {
            what: parts.length === 2 ? t('common.and', { a: parts[0], b: parts[1] }) : parts[0],
          })
        : t('share.allSent');
    } catch (error) {
      shareStatus = 'error';
      shareMessage = t('share.failed', {
        error: String(error instanceof Error ? error.message : error),
      });
    }
  }
</script>

<section class="card">
  <div class="card-head"><h2>{t('share.title')}</h2></div>
  <div class="card-body stack">
    <p class="hint">
      {t('share.hintVoor')} <a href="#privacy">{t('menu.privacy')}</a>{t('share.hintNa')}
    </p>
    <label class="check">
      <input type="checkbox" bind:checked={sharing} onchange={() => setShareEnabled(sharing)} />
      {t('share.sessions')}
    </label>
    <label class="check">
      <input
        type="checkbox"
        bind:checked={sharingAudio}
        disabled={!sharing}
        onchange={() => setShareAudio(sharingAudio)}
      />
      {t('share.audio')}
    </label>
    {#if sharing}
      <button class="btn secondary block" disabled={shareStatus === 'busy'} onclick={shareManually}>
        {shareStatus === 'busy' ? t('common.busy') : t('share.now')}
      </button>
      <p class="hint" class:error={shareStatus === 'error'}>
        {shareMessage ||
          (sharedAt
            ? t('share.lastSent', { date: dateYearTimeFormat.format(sharedAt) })
            : t('share.nothingSent'))}
      </p>
    {/if}
    {#if showName}
      <form class="name stack" onsubmit={saveName}>
        <label>
          {t('settings.nameLabel')}
          <input bind:value={displayName} maxlength="40" autocomplete="name" />
        </label>
        <p class="hint">{t('settings.nameHint')}</p>
        <button class="btn secondary block" disabled={nameStatus === 'busy'}>
          {t('common.save')}
        </button>
        {#if nameMessage}
          <p class="hint" class:error={nameStatus === 'error'}>{nameMessage}</p>
        {/if}
      </form>
    {/if}
  </div>
</section>

<style>
  .hint a {
    color: inherit;
  }

  /* De naam los van de keuzes erboven */
  .name {
    border-top: 1px solid var(--border);
    padding-top: 1rem;
  }

  .name label {
    display: grid;
    gap: 0.25rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--muted);
  }

  .name input {
    font-weight: 400;
  }
</style>
