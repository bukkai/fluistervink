<script lang="ts">
  import gullUrl from '../assets/zeemeeuw.png';
  import { zeemeeuw } from './zeemeeuw.svelte';

  // Scherm vol boze meeuwen (zie zeemeeuw.svelte.ts). Elke keer anders
  // geplaatst; tikken sluit, en na een paar seconden gaan ze vanzelf weg.

  const CRIES = [
    'KRIJS!',
    'KJAUW!',
    'GIEK!',
    'AAAH!',
    'KJIEW!',
    'Zilvermeeuw!',
    'Kokmeeuw!',
    'ZEE?!',
  ];
  const COLS = 4;
  const ROWS = 4;
  const SHOW_MS = 7000;

  interface Gull {
    left: number;
    top: number;
    size: number;
    flip: boolean;
    tilt: number;
    delay: number;
    shake: number;
    peck: number;
    rage: boolean;
    cry?: string;
  }

  let gulls = $state<Gull[]>([]);
  let leaving = $state(false);

  const rand = (min: number, max: number) => min + Math.random() * (max - min);

  function spawn(): Gull[] {
    const list: Gull[] = [];
    for (let i = 0; i < COLS * ROWS; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      list.push({
        left: (col / COLS) * 100 - 12 + rand(0, 14),
        top: (row / ROWS) * 100 - 10 + rand(0, 12),
        size: rand(34, 58),
        flip: Math.random() < 0.5,
        tilt: rand(-14, 14),
        delay: 0,
        shake: rand(0.08, 0.16),
        peck: rand(0.45, 0.8),
        rage: Math.random() < 0.6,
        cry: Math.random() < 0.45 ? CRIES[Math.floor(Math.random() * CRIES.length)] : undefined,
      });
    }
    // In willekeurige volgorde binnenvallen
    list.sort(() => Math.random() - 0.5);
    list.forEach((gull, i) => (gull.delay = i * 70));
    return list;
  }

  $effect(() => {
    if (!zeemeeuw.visible) return;
    gulls = spawn();
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
      zeemeeuw.visible = false;
      leaving = false;
    }, 300);
  }
</script>

{#if zeemeeuw.visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="overlay"
    class:leaving
    role="alertdialog"
    aria-label="Zeemeeuwen bestaan niet"
    tabindex="-1"
    onclick={close}
  >
    <div class="quake">
      {#each gulls as gull, i (i)}
        <div
          class="gull"
          style:left="{gull.left}%"
          style:top="{gull.top}%"
          style:width="{gull.size}vmin"
          style:z-index={i}
          style:--delay="{gull.delay}ms"
          style:--tilt="{gull.tilt}deg"
          style:--shake="{gull.shake}s"
          style:--peck="{gull.peck}s"
        >
          <div class="shake">
            <div class="peck" class:flip={gull.flip}>
              <img src={gullUrl} alt="" class:rage={gull.rage} draggable="false" />
              <span class="brow"></span>
              <span class="eye"></span>
            </div>
            {#if gull.cry}
              <span class="cry" class:right={gull.flip}>{gull.cry}</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <p class="shout">ZEEMEEUW?!</p>
    <div class="card message">
      <strong>Een zeemeeuw bestaat niet.</strong>
      Zilvermeeuw? Kokmeeuw? Stormmeeuw? Grote mantelmeeuw?
      <span class="hint">Tik om de meeuwen te kalmeren</span>
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
    /* Alles erachter feller en harder */
    backdrop-filter: contrast(1.4) saturate(1.8);
    animation: flash 0.5s ease-out;
    transition: opacity 0.3s;
  }
  .overlay.leaving {
    opacity: 0;
  }
  /* Pulserende rode rand */
  .overlay::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at center, transparent 35%, rgb(190 0 0 / 0.65) 100%);
    animation: pulse 0.5s ease-in-out infinite alternate;
    pointer-events: none;
  }

  .quake {
    position: absolute;
    inset: 0;
    animation: quake 0.09s linear 14;
  }

  .gull {
    position: absolute;
    animation: pop 0.35s cubic-bezier(0.3, 1.8, 0.5, 1) var(--delay) both;
  }
  .shake {
    position: relative;
    animation: shake var(--shake) linear infinite alternate;
  }
  .peck {
    position: relative;
    transform-origin: 70% 80%;
    animation: peck var(--peck) ease-in-out infinite;
  }
  .peck.flip {
    scale: -1 1;
  }
  img {
    display: block;
    width: 100%;
    filter: drop-shadow(0 6px 10px rgb(0 0 0 / 0.35));
  }
  img.rage {
    animation: rage 0.4s ease-in-out infinite alternate;
  }

  /* Boze wenkbrauw en gloeiend oog, op de plek van het oog in het plaatje */
  .brow {
    position: absolute;
    left: 15%;
    top: 9.5%;
    width: 16%;
    height: 3%;
    border-radius: 2px;
    background: #2a1a12;
    rotate: -24deg;
  }
  .eye {
    position: absolute;
    left: 20.5%;
    top: 11.5%;
    width: 6%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: radial-gradient(circle, #fff 0 15%, #ff2a00 40%, rgb(255 0 0 / 0) 72%);
    scale: 2.2;
    animation: glow 0.3s ease-in-out infinite alternate;
  }

  .cry {
    position: absolute;
    top: -6%;
    left: -12%;
    padding: 0.15em 0.5em;
    border: 3px solid #1d1d1d;
    border-radius: 1em;
    background: #fff;
    color: #c00;
    font-weight: 900;
    font-size: clamp(0.9rem, 4.5vmin, 1.6rem);
    white-space: nowrap;
    rotate: -10deg;
    box-shadow: 3px 3px 0 #1d1d1d;
  }
  .cry.right {
    left: auto;
    right: -12%;
    rotate: 10deg;
  }

  .shout {
    position: absolute;
    top: 38%;
    left: 50%;
    z-index: 100;
    margin: 0;
    translate: -50% -50%;
    color: #fff;
    font-weight: 900;
    font-size: clamp(2.5rem, 15vmin, 6rem);
    letter-spacing: 0.02em;
    -webkit-text-stroke: 3px #7a0000;
    text-shadow:
      0 0 20px #f00,
      5px 5px 0 #7a0000;
    animation: shout 0.15s linear infinite alternate;
    pointer-events: none;
  }

  .message {
    position: absolute;
    left: 16px;
    right: 16px;
    bottom: max(16px, env(safe-area-inset-bottom));
    z-index: 100;
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

  @keyframes flash {
    from {
      background: rgb(255 255 255 / 0.9);
    }
    to {
      background: transparent;
    }
  }
  @keyframes pulse {
    to {
      opacity: 0.45;
    }
  }
  @keyframes quake {
    0% {
      translate: 6px -4px;
    }
    33% {
      translate: -7px 5px;
    }
    66% {
      translate: 4px 7px;
    }
    100% {
      translate: 0 0;
    }
  }
  @keyframes pop {
    from {
      scale: 0;
      rotate: 0deg;
    }
    to {
      scale: 1;
      rotate: var(--tilt);
    }
  }
  @keyframes shake {
    from {
      translate: -3px 1px;
      rotate: -2deg;
    }
    to {
      translate: 3px -2px;
      rotate: 2deg;
    }
  }
  @keyframes peck {
    0%,
    100% {
      transform: none;
    }
    40% {
      transform: scale(1.12) rotate(-9deg) translateX(-4%);
    }
  }
  @keyframes rage {
    to {
      filter: sepia(0.6) saturate(4) hue-rotate(-25deg) contrast(1.3)
        drop-shadow(0 0 16px rgb(255 0 0 / 0.85));
    }
  }
  @keyframes glow {
    to {
      scale: 2.8;
      opacity: 0.75;
    }
  }
  @keyframes shout {
    from {
      rotate: -3deg;
      scale: 1;
    }
    to {
      rotate: 3deg;
      scale: 1.06;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .quake,
    .shake,
    .peck,
    .shout,
    img.rage,
    .eye,
    .overlay::before {
      animation: none;
    }
  }
</style>
