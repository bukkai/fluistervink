<script lang="ts">
  import { t } from './i18n';
  import { dateYearTimeFormat } from './format';
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

  let sharing = $state(shareEnabled());
  let sharingAudio = $state(shareAudio());
  let sharedAt = $state(lastSharedAt());
  let shareStatus = $state<'idle' | 'busy' | 'error'>('idle');
  let shareMessage = $state('');

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
  </div>
</section>

<style>
  .hint a {
    color: inherit;
  }
</style>
