<script lang="ts">
  import { t } from './i18n';
  import buizerdUrl from '../assets/buizerd.webp';
  import { tochEenBuizerd } from './eastereggs.svelte';

  // #tocheenbuizerd (zie eastereggs.svelte.ts): een buizerd springt vanuit de
  // hoek het scherm in, met een stralenkrans erachter, en krijst. Na een paar
  // seconden of een tik is hij weg. Foto: Pixabay (Pixabay-licentie, vrij te
  // gebruiken zonder naamsvermelding), uitgeknipt door de eigenaar:
  // https://pixabay.com/nl/photos/bek-buizerd-hoofd-krachtig-1888988/

  const SHOW_MS = 6000;

  let leaving = $state(false);

  $effect(() => {
    if (!tochEenBuizerd.visible) return;
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
      tochEenBuizerd.visible = false;
      leaving = false;
    }, 300);
  }
</script>

{#if tochEenBuizerd.visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="overlay"
    class:leaving
    role="alertdialog"
    aria-label={t('buizerd.label')}
    tabindex="-1"
    onclick={close}
  >
    <div class="rays" aria-hidden="true"></div>

    <div class="text">
      <p class="hashtag">{t('buizerd.hashtag')}</p>
      <p class="message">{t('buizerd.message')}</p>
      <p class="hint">{t('egg.hint')}</p>
    </div>

    <div class="bird">
      <div class="head">
        <img src={buizerdUrl} alt="" draggable="false" />
      </div>
      <span class="bubble">{t('buizerd.cry')}</span>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    /* Boven alles, ook de kopbalk (1100) en de kaart */
    z-index: 2000;
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

  /* Draaiende stralenkrans achter de kop, naar de rand toe vervagend */
  .rays {
    position: absolute;
    right: -60vmax;
    bottom: -60vmax;
    width: 160vmax;
    aspect-ratio: 1;
    translate: -10% -20%;
    background: repeating-conic-gradient(rgb(242 193 46 / 0.18) 0 10deg, transparent 10deg 20deg);
    mask-image: radial-gradient(circle, #000 10%, transparent 45%);
    animation:
      fade 0.6s ease-out 0.3s both,
      spin 18s linear infinite;
  }

  .text {
    position: absolute;
    top: max(24px, env(safe-area-inset-top));
    left: 16px;
    right: 16px;
    text-align: center;
    color: #fff;
  }
  .hashtag {
    margin: 0;
    font-weight: 900;
    font-size: clamp(1.6rem, 8.5vmin, 3.5rem);
    letter-spacing: 0.01em;
    overflow-wrap: anywhere;
    text-shadow: 3px 3px 0 var(--breast-strong);
    animation: pop 0.4s cubic-bezier(0.3, 1.8, 0.5, 1) 0.6s both;
  }
  .message {
    margin: 0.4rem 0 0;
    font-weight: 700;
    font-size: 1.15rem;
    animation: fade 0.4s ease-out 0.9s both;
  }
  .hint {
    margin: 0.3rem 0 0;
    color: rgb(255 255 255 / 0.7);
    font-size: 0.85rem;
    animation: fade 0.4s ease-out 1.2s both;
  }

  /* De foto is rechts en onder afgesneden: daar zit hij vast aan de hoek */
  .bird {
    position: absolute;
    right: 0;
    bottom: 0;
    width: min(100vw, 60vh, 36rem);
    animation: swoop 0.6s cubic-bezier(0.25, 1.4, 0.5, 1) both;
  }
  .head {
    transform-origin: 85% 100%;
    animation: screech 0.9s ease-in-out 0.7s infinite;
  }
  img {
    display: block;
    width: 100%;
    filter: drop-shadow(-6px 8px 14px rgb(0 0 0 / 0.45));
  }

  /* Tekstballon bij de snavel (hij kijkt naar links), met een staartje */
  .bubble {
    position: absolute;
    left: 4%;
    bottom: 78%;
    padding: 0.3em 0.7em;
    border: 3px solid #1d1d1d;
    border-radius: 1.2em;
    background: #fff;
    color: var(--breast-strong);
    font-weight: 900;
    font-size: clamp(1.1rem, 6.5vmin, 2rem);
    white-space: nowrap;
    rotate: -8deg;
    box-shadow: 3px 3px 0 #1d1d1d;
    transform-origin: 20% 100%;
    animation:
      pop 0.35s cubic-bezier(0.3, 1.8, 0.5, 1) 0.55s both,
      wobble 0.45s ease-in-out 0.9s infinite alternate;
  }
  .bubble::after {
    content: '';
    position: absolute;
    left: 18%;
    bottom: -0.55em;
    width: 0.8em;
    height: 0.8em;
    border-right: 3px solid #1d1d1d;
    border-bottom: 3px solid #1d1d1d;
    background: #fff;
    transform: rotate(35deg) skew(15deg, 15deg);
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  @keyframes spin {
    to {
      rotate: 360deg;
    }
  }
  @keyframes swoop {
    from {
      translate: 70% 70%;
      rotate: 20deg;
    }
    to {
      translate: 0 0;
      rotate: 0deg;
    }
  }
  /* Krijsen: kop omhoog, even blijven, terug */
  @keyframes screech {
    0%,
    60%,
    100% {
      rotate: 0deg;
    }
    15%,
    40% {
      rotate: 4deg;
      scale: 1.03;
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
  @keyframes wobble {
    from {
      rotate: -10deg;
    }
    to {
      rotate: -5deg;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .overlay,
    .rays,
    .hashtag,
    .message,
    .hint,
    .bird,
    .head,
    .bubble {
      animation: none;
    }
  }
</style>
