<script lang="ts">
  import { t } from './i18n';
  import barrieUrl from '../assets/barrie.jpg';
  import { barrie } from './eastereggs.svelte';

  // Barrie de Buizerd (zie eastereggs.svelte.ts): hij slaat het scherm in als
  // een sticker, krijst, en na een paar seconden of een tik is hij weg.
  // De foto is CC0 (publiek domein); de naam Barrie komt uit de Discord.

  const SHOW_MS = 6000;

  let leaving = $state(false);

  $effect(() => {
    if (!barrie.visible) return;
    leaving = false;
    const timer = setTimeout(close, SHOW_MS);
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  });

  function close() {
    if (leaving) return;
    leaving = true;
    setTimeout(() => {
      barrie.visible = false;
      leaving = false;
    }, 300);
  }
</script>

{#if barrie.visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="overlay"
    class:leaving
    role="alertdialog"
    aria-label={t('barrie.label')}
    tabindex="-1"
    onclick={close}
  >
    <div class="stage">
      <div class="sticker">
        <img src={barrieUrl} alt={t('barrie.name')} draggable="false" />
        <span class="cry">{t('barrie.cry')}</span>
      </div>
      <p class="hashtag">{t('barrie.hashtag')}</p>
    </div>
    <div class="card message">
      <strong>{t('barrie.message')}</strong>
      {t('barrie.name')}
      <span class="hint">{t('egg.hint')}</span>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    /* Boven alles, ook de kopbalk (1100) en de kaart */
    z-index: 2000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px;
    overflow: hidden;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    background: rgb(36 34 31 / 0.85);
    animation: fade 0.25s ease-out;
    transition: opacity 0.3s;
  }
  .overlay.leaving {
    opacity: 0;
  }

  .stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    /* Ruimte voor de kaart onderaan */
    margin-bottom: 7rem;
  }

  .sticker {
    position: relative;
    width: min(78vw, 52vh, 26rem);
    animation:
      slam 0.55s cubic-bezier(0.2, 1.6, 0.4, 1) both,
      screech 0.12s linear 0.55s 10 alternate;
  }
  img {
    display: block;
    width: 100%;
    border: 6px solid #fff;
    border-radius: 18%;
    box-shadow: 0 12px 30px rgb(0 0 0 / 0.5);
  }

  .cry {
    position: absolute;
    /* Bij de snavel: hij kijkt naar links */
    top: -8%;
    left: -6%;
    padding: 0.15em 0.55em;
    border: 3px solid #1d1d1d;
    border-radius: 1em;
    background: #fff;
    color: var(--breast-strong);
    font-weight: 900;
    font-size: clamp(1rem, 6vmin, 1.8rem);
    white-space: nowrap;
    rotate: -12deg;
    box-shadow: 3px 3px 0 #1d1d1d;
    animation: pop 0.3s cubic-bezier(0.3, 1.8, 0.5, 1) 0.5s both;
  }

  .hashtag {
    margin: 1.2rem 0 0;
    color: #fff;
    font-weight: 900;
    font-size: clamp(1.6rem, 8.5vmin, 3.5rem);
    letter-spacing: 0.01em;
    text-align: center;
    overflow-wrap: anywhere;
    text-shadow: 3px 3px 0 var(--breast-strong);
    animation: pop 0.4s cubic-bezier(0.3, 1.8, 0.5, 1) 0.7s both;
  }

  .message {
    position: absolute;
    left: 16px;
    right: 16px;
    bottom: max(16px, env(safe-area-inset-bottom));
    max-width: 28rem;
    margin: 0 auto;
    text-align: center;
    line-height: 1.4;
  }
  .message strong {
    display: block;
    font-size: 1.15rem;
  }
  .hint {
    display: block;
    margin-top: 0.4rem;
    color: var(--muted);
    font-size: 0.85rem;
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  @keyframes slam {
    from {
      scale: 3;
      rotate: -25deg;
      opacity: 0;
    }
    to {
      scale: 1;
      rotate: -3deg;
      opacity: 1;
    }
  }
  /* Krijsen: even trillen na de klap */
  @keyframes screech {
    from {
      translate: -4px 2px;
    }
    to {
      translate: 4px -2px;
    }
  }
  @keyframes pop {
    from {
      scale: 0;
    }
    to {
      scale: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .overlay,
    .sticker,
    .cry,
    .hashtag {
      animation: none;
    }
  }
</style>
