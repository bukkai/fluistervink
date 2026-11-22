<script lang="ts">
  import { t } from './i18n';
  import { lifer } from './eastereggs.svelte';
  import { speciesLabel } from './vocab';

  // Feest bij een lifer (zie eastereggs.svelte.ts): slingers, confetti en een
  // juichende vink. Tikken sluit, en na een paar seconden is het vanzelf voorbij.

  const SHOW_MS = 7000;
  const PIECES = 70;
  const FLAGS = 13;
  /** Vinkenkleuren en die van de zeldzaamheid: rustig maar feestelijk */
  const COLORS = ['#b67a50', '#6f7587', '#f2c12e', '#7ab648', '#3ec1d3', '#e5493a', '#d9a3a0'];

  interface Piece {
    left: number;
    size: number;
    color: string;
    delay: number;
    fall: number;
    sway: number;
    spin: number;
    round: boolean;
  }

  let pieces = $state<Piece[]>([]);
  let leaving = $state(false);
  const species = $derived(lifer.speciesId !== undefined ? speciesLabel(lifer.speciesId) : '');

  const rand = (min: number, max: number) => min + Math.random() * (max - min);
  const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

  function spawn(): Piece[] {
    return Array.from({ length: PIECES }, () => ({
      left: rand(0, 100),
      size: rand(6, 12),
      color: pick(COLORS),
      delay: rand(0, 2.5),
      fall: rand(2.8, 5),
      sway: rand(-40, 40),
      spin: rand(360, 1080) * (Math.random() < 0.5 ? -1 : 1),
      round: Math.random() < 0.3,
    }));
  }

  /** Vlaggetjes langs een doorhangend touw, in een viewBox van 100 breed */
  const flags = Array.from({ length: FLAGS }, (_, i) => {
    const x = (i + 0.5) * (100 / FLAGS);
    // Doorhangen: een parabool, laag in het midden
    const sag = (x: number) => 2 + 10 * (1 - ((x - 50) / 50) ** 2);
    const half = 100 / FLAGS / 2 - 0.6;
    return {
      points: `${x - half},${sag(x - half)} ${x + half},${sag(x + half)} ${x},${sag(x) + 9}`,
      color: COLORS[i % COLORS.length],
    };
  });

  $effect(() => {
    if (!lifer.visible) return;
    pieces = spawn();
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
      lifer.visible = false;
      leaving = false;
    }, 300);
  }
</script>

{#if lifer.visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="overlay"
    class:leaving
    role="alertdialog"
    aria-label={t('lifer.label')}
    tabindex="-1"
    onclick={close}
  >
    <svg class="bunting" viewBox="0 0 100 22" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0,2 Q50,22 100,2" fill="none" stroke="#7a5a3c" stroke-width="0.4" />
      {#each flags as flag, i (i)}
        <polygon points={flag.points} fill={flag.color} />
      {/each}
    </svg>

    <div class="confetti" aria-hidden="true">
      {#each pieces as piece, i (i)}
        <span
          class="piece"
          class:round={piece.round}
          style:left="{piece.left}%"
          style:width="{piece.size}px"
          style:height="{piece.round ? piece.size : piece.size * 0.45}px"
          style:background={piece.color}
          style:--delay="{piece.delay}s"
          style:--fall="{piece.fall}s"
          style:--sway="{piece.sway}px"
          style:--spin="{piece.spin}deg"
        ></span>
      {/each}
    </div>

    <div class="stage">
      <div class="vink">
        <span class="hat"></span>
        <img src="/icon.svg" alt="" draggable="false" />
      </div>
      <p class="shout">{t('lifer.shout')}</p>
    </div>

    <div class="card message">
      {#if species}<strong>{species}</strong>{/if}
      {t('lifer.congrats')}
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
    align-items: center;
    justify-content: center;
    overflow: hidden;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    background: rgb(244 241 237 / 0.9);
    animation: fade 0.25s ease-out;
    transition: opacity 0.3s;
  }
  .overlay.leaving {
    opacity: 0;
  }

  .bunting {
    position: absolute;
    top: env(safe-area-inset-top);
    left: 0;
    width: 100%;
    height: clamp(4rem, 14vh, 8rem);
    transform-origin: top;
    animation: drop 0.6s cubic-bezier(0.3, 1.5, 0.5, 1) both;
  }

  .confetti {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .piece {
    position: absolute;
    top: -20px;
    border-radius: 1px;
    animation: fall var(--fall) linear var(--delay) infinite;
  }
  .piece.round {
    border-radius: 50%;
  }

  .stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 6rem;
  }
  .vink {
    position: relative;
    width: min(40vw, 28vh, 11rem);
    animation: hop 0.5s ease-in-out infinite alternate;
  }
  .vink img {
    display: block;
    width: 100%;
  }
  /* Feesthoedje */
  .hat {
    position: absolute;
    top: -26%;
    left: 34%;
    width: 30%;
    aspect-ratio: 0.75;
    clip-path: polygon(50% 0, 100% 100%, 0 100%);
    background: repeating-linear-gradient(135deg, #e5493a 0 10%, #f2c12e 10% 20%);
    rotate: -14deg;
  }

  .shout {
    margin: 0.6rem 0 0;
    color: var(--breast-strong);
    font-weight: 900;
    font-size: clamp(3rem, 18vmin, 7rem);
    letter-spacing: 0.03em;
    line-height: 1;
    text-shadow: 4px 4px 0 var(--brand);
    animation:
      pop 0.5s cubic-bezier(0.3, 1.8, 0.5, 1) 0.2s both,
      wiggle 0.6s ease-in-out 0.7s infinite alternate;
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
  @keyframes drop {
    from {
      scale: 1 0;
    }
  }
  @keyframes fall {
    from {
      translate: 0 0;
      rotate: 0deg;
    }
    to {
      translate: var(--sway) 110vh;
      rotate: var(--spin);
    }
  }
  @keyframes hop {
    from {
      translate: 0 0;
      rotate: -4deg;
    }
    to {
      translate: 0 -12%;
      rotate: 4deg;
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
  @keyframes wiggle {
    from {
      rotate: -3deg;
    }
    to {
      rotate: 3deg;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .overlay,
    .bunting,
    .vink,
    .shout {
      animation: none;
    }
    /* Confetti blijft liggen in plaats van te vallen */
    .piece {
      animation: none;
      top: auto;
      bottom: calc(var(--delay) * 10%);
    }
  }
</style>
