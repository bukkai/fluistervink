<script lang="ts">
  // Statistieken, alleen voor de eigenaar: hoeveel mensen de app gebruiken en
  // of ze terugkomen (src/lib/stats.ts). Alleen totalen, geen namen: wie wat
  // deed staat al op Developer, hier gaat het om de trend.
  import { listActivity, listSummaries, listTesters, type Tester } from './api';
  import {
    cohorts,
    funnel,
    MIN_GROUP,
    addDays,
    perDay,
    perSessionWeek,
    perWeek,
    RETENTION_WEEKS,
    STAY_DAYS,
    weekOf,
    type ActivityRow,
    type SummaryRow,
  } from './stats';
  import { dayOf } from './costs';
  import { asOwner, LAUNCH_DAY, ownInstalls, testPhaseNames, withoutTestPhase } from './testers';

  const DAYS = 30;
  /** Grafiek en tabel even lang, zodat elke week in de grafiek een rij heeft */
  const WEEKS = 12;
  // Grafiek per week: vaste maat, schaalt mee met de breedte van de kaart
  const W = 320;
  const H = 120;
  const PAD = 6;
  const STEP = (W - 2 * PAD) / (WEEKS - 1);

  let rows = $state<ActivityRow[]>();
  let error = $state('');
  let withOwner = $state(false);
  /** Testers van vóór de productierelease meetellen (testers.ts, LAUNCH_DAY) */
  let withTestPhase = $state(false);

  listActivity('2026-01-01')
    .then((result) => (rows = result))
    .catch((e) => (error = `Ophalen mislukt: ${e instanceof Error ? e.message : e}`));
  // Installaties: voor de trechter en Play tegenover browser. Mislukt dat, dan
  // ontbreken alleen die twee.
  // Anonieme cijfers per sessie (summaries.ts), de laatste 12 weken. Mislukt
  // het ophalen, dan ontbreekt alleen die kaart.
  let summaries = $state<SummaryRow[]>();
  listSummaries(addDays(dayOf(new Date()), -7 * 12))
    .then((result) => (summaries = result))
    .catch(() => (summaries = undefined));
  let sessionWeeks = $derived(
    perSessionWeek(withTestPhase ? (summaries ?? []) : withoutTestPhase(summaries ?? [])),
  );
  let allSessions = $derived(sessionWeeks.at(-1));
  /** Een deel als percentage, alleen bij een groep van minstens MIN_GROUP sessies */
  const pct = (share: number, sessions: number) =>
    sessions >= MIN_GROUP ? `${Math.round(share * 100)}%` : '–';
  let installs = $state<Tester[]>();
  listTesters()
    .then((result) => (installs = result))
    .catch(() => (installs = undefined));

  // Installaties van de eigenaar zelf tellen als de eigenaar (testers.ts)
  let own = $derived(ownInstalls(installs ?? []));
  let allRows = $derived(asOwner(rows ?? [], own));
  let testPhase = $derived(testPhaseNames(rows ?? [], installs ?? []));
  let counted = $derived(
    allRows.filter(
      (r) => (withOwner || r.tester !== 'eigenaar') && (withTestPhase || !testPhase.has(r.tester)),
    ),
  );
  let days = $derived(perDay(counted, DAYS));
  let weeks = $derived(perWeek(counted, WEEKS));
  /** Laatste weken van eerste gebruik; ouder past niet op een telefoon */
  const COHORTS = 12;
  let cohortRows = $derived(cohorts(counted).slice(0, COHORTS));
  /**
   * Alle groepen samen, per week na het begin: telt alleen groepen waarvoor die
   * week al om is. Zo is er al een cijfer voordat één week groot genoeg is.
   */
  let cohortTotal = $derived(
    RETENTION_WEEKS.map((_, i) => {
      const done = cohorts(counted).filter((c) => c.retained[i] !== undefined);
      const size = done.reduce((sum, c) => sum + c.size, 0);
      const kept = done.reduce((sum, c) => sum + c.retained[i]! * c.size, 0);
      return { size, share: size ? kept / size : undefined };
    }),
  );
  let steps = $derived(
    installs
      ? funnel(
          allRows,
          installs
            .filter((t) => !t.owner && (withTestPhase || !testPhase.has(t.name)))
            .map((t) => t.name),
        )
      : undefined,
  );
  /**
   * Actief deze week, per manier van aanmelden (Play = Android-app), en in de
   * browser per soort toestel: hoeveel mensen een iPhone gebruiken.
   */
  let byVia = $derived.by(() => {
    if (!installs) return undefined;
    const byName = new Map(installs.map((t) => [t.name, t]));
    const thisWeek = weekOf(dayOf(new Date()));
    const active = new Set(counted.filter((r) => weekOf(r.day) === thisWeek).map((r) => r.tester));
    let play = 0;
    let browser = 0;
    const devices = { ios: 0, android: 0, computer: 0, unknown: 0 };
    for (const tester of active) {
      const install = byName.get(tester);
      if (install?.via === 'play') play++;
      else if (install?.via === 'turnstile') {
        browser++;
        devices[install.device ?? 'unknown']++;
      }
    }
    return { play, browser, devices };
  });
  /** "3 iPhone, 1 Android", alleen wat er is */
  let browserDevices = $derived(
    byVia
      ? (
          [
            ['ios', 'iPhone'],
            ['android', 'Android'],
            ['computer', 'computer'],
            ['unknown', 'onbekend'],
          ] as const
        )
          .filter(([key]) => byVia.devices[key])
          .map(([key, label]) => `${byVia.devices[key]} ${label}`)
          .join(', ')
      : '',
  );
  const percent = (part: number, whole: number) =>
    whole ? `${Math.round((part / whole) * 100)}%` : '–';
  let maxUsers = $derived(Math.max(1, ...days.map((d) => d.users)));
  // Oudste week eerst, voor de grafiek
  let chartWeeks = $derived([...weeks].reverse());
  /** Aangetikte week in de grafiek, gemarkeerd in de tabel */
  let selected = $state<string>();
  function select(week: string) {
    selected = selected === week ? undefined : week;
    if (selected) {
      document
        .getElementById(`week-${selected}`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
  let maxWeek = $derived(Math.max(1, ...chartWeeks.map((w) => Math.max(w.sessions, w.utterances))));
  const x = (i: number) => PAD + i * STEP;
  const y = (value: number, max: number) => H - PAD - (value / max) * (H - 2 * PAD);
  function line(key: 'sessions' | 'utterances'): string {
    return chartWeeks.map((w, i) => `${x(i)},${y(w[key], maxWeek)}`).join(' ');
  }
  function weekLabel(w: (typeof chartWeeks)[number]): string {
    return `Week van ${shortFormat.format(date(w.week))}: ${w.sessions} sessies, ${w.utterances} uitspraken`;
  }

  const dayFormat = new Intl.DateTimeFormat('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const shortFormat = new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const date = (day: string) => new Date(`${day}T00:00:00Z`);

  function dayLabel(d: (typeof days)[number]): string {
    const users = d.users === 1 ? '1 gebruiker' : `${d.users} gebruikers`;
    return `${dayFormat.format(date(d.day))}: ${users}, ${d.sessions} sessies, ${d.utterances} uitspraken`;
  }
</script>

<a class="back" href="#/">Terug</a>
<h2 class="page-title">Statistieken</h2>
<p class="muted intro">
  Uit het verbruik dat de proxy al telt voor de kosten: wie op een dag minstens één uitspraak
  insprak in een sessie. Alleen thuis nalopen telt niet mee, de testset ook niet.
</p>

<label class="owner">
  <input type="checkbox" bind:checked={withOwner} />
  Mijn eigen gebruik meetellen
</label>
{#if LAUNCH_DAY}
  <label class="owner">
    <input type="checkbox" bind:checked={withTestPhase} />
    Testers van vóór {shortFormat.format(date(LAUNCH_DAY))} meetellen
  </label>
{/if}

{#if error}
  <p class="error">{error}</p>
{:else if rows}
  <section class="card">
    <div class="card-head"><h2>Deze week</h2></div>
    <div class="card-body">
      <dl class="totals">
        <div>
          <dt>Vandaag</dt>
          <dd>{days[days.length - 1].users}</dd>
        </div>
        <div>
          <dt>Deze week</dt>
          <dd>{weeks[0].active}</dd>
        </div>
        <div>
          <dt>Nieuw</dt>
          <dd>{weeks[0].new}</dd>
        </div>
      </dl>
      <p class="muted hint">
        Vorige week {weeks[1].active} actief, waarvan {weeks[0].returning} deze week terug.
        {#if byVia}
          Deze week {byVia.play} in de Android-app en {byVia.browser} in de browser{browserDevices
            ? ` (${browserDevices})`
            : ''}.
        {/if}
      </p>
    </div>
  </section>

  {#if steps}
    <section class="card">
      <div class="card-head"><h2>Van installeren tot vaste gebruiker</h2></div>
      <div class="card-body">
        <ol class="steps">
          <li>
            <span>Geïnstalleerd</span>
            <strong>{steps.installed}</strong>
          </li>
          <li>
            <span>Iets ingesproken</span>
            <strong>{steps.used}</strong>
            <span class="muted">{percent(steps.used, steps.installed)}</span>
          </li>
          <li>
            <span>Tweede sessie</span>
            <strong>{steps.returned}</strong>
            <span class="muted">{percent(steps.returned, steps.used)}</span>
          </li>
          <li>
            <span>Na {STAY_DAYS / 7} weken nog actief</span>
            <strong>{steps.stayed}</strong>
            <span class="muted">
              {steps.eligible >= MIN_GROUP ? percent(steps.stayed, steps.eligible) : '–'}
            </span>
          </li>
        </ol>
        <p class="muted hint">
          Elk percentage van de stap ervoor. De laatste stap telt alleen wie minstens {STAY_DAYS /
            7} weken geleden begon ({steps.eligible}), met een percentage vanaf {MIN_GROUP}. Zonder
          de eigenaar en zonder testers van vóór het aanmelden zonder code{LAUNCH_DAY &&
          !withTestPhase
            ? ', en zonder de testfase'
            : ''}.
        </p>
      </div>
    </section>
  {/if}

  <section class="card">
    <div class="card-head">
      <h2>Blijven ze?</h2>
      <span class="muted">per week van eerste gebruik</span>
    </div>
    <div class="card-body table">
      <table>
        <thead>
          <tr>
            <th scope="col">Begonnen</th>
            <th scope="col">Aantal</th>
            {#each RETENTION_WEEKS as offset (offset)}
              <th scope="col">{offset} wk</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each cohortRows as c (c.week)}
            <tr>
              <th scope="row">{shortFormat.format(date(c.week))}</th>
              <td>{c.size}</td>
              {#each c.retained as share, i (i)}
                <td>
                  {share === undefined || c.size < MIN_GROUP ? '–' : `${Math.round(share * 100)}%`}
                </td>
              {/each}
            </tr>
          {/each}
          <tr class="total">
            <th scope="row">Alle</th>
            <td></td>
            {#each cohortTotal as total, i (i)}
              <td>
                {total.share === undefined || total.size < MIN_GROUP
                  ? '–'
                  : `${Math.round(total.share * 100)}%`}
              </td>
            {/each}
          </tr>
        </tbody>
      </table>
      <p class="muted hint">
        Welk deel in precies die week na de eerste week nog iets insprak. Een percentage alleen bij
        minstens {MIN_GROUP} mensen, en alleen voor weken die om zijn. Alle: de groepen samen waarvoor
        die week al om is.
      </p>
    </div>
  </section>

  {#if summaries?.length && allSessions}
    <section class="card">
      <div class="card-head">
        <h2>Hoe sessies gaan</h2>
        <span class="muted">anoniem, laatste 12 weken</span>
      </div>
      <div class="card-body table">
        <dl class="facts">
          <div>
            <dt>Sessies</dt>
            <dd>{allSessions.sessions}</dd>
          </div>
          <div>
            <dt>Duur (mediaan)</dt>
            <dd>{allSessions.minutes} min</dd>
          </div>
          <div>
            <dt>Uitspraken per sessie</dt>
            <dd>{Math.round(allSessions.utterances)}</dd>
          </div>
          <div>
            <dt>Niet begrepen</dt>
            <dd>{pct(allSessions.notUnderstood, allSessions.sessions)}</dd>
          </div>
          <div>
            <dt>Met de stem verbeterd</dt>
            <dd>{pct(allSessions.corrections, allSessions.sessions)}</dd>
          </div>
          <div>
            <dt>Mislukt</dt>
            <dd>{pct(allSessions.failed, allSessions.sessions)}</dd>
          </div>
          <div>
            <dt>Onzeker</dt>
            <dd>{pct(allSessions.uncertain, allSessions.sessions)}</dd>
          </div>
          <div>
            <dt>Nagelopen</dt>
            <dd>{pct(allSessions.reviewed, allSessions.sessions)}</dd>
          </div>
          <div>
            <dt>Geëxporteerd</dt>
            <dd>{pct(allSessions.exported, allSessions.sessions)}</dd>
          </div>
          <div>
            <dt>Op bereik gewacht</dt>
            <dd>{pct(allSessions.offline, allSessions.sessions)}</dd>
          </div>
          <div>
            <dt>In de Android-app</dt>
            <dd>{pct(allSessions.android, allSessions.sessions)}</dd>
          </div>
        </dl>
        <table>
          <thead>
            <tr>
              <th scope="col">Week van</th>
              <th scope="col">Sessies</th>
              <th scope="col">Niet begr.</th>
              <th scope="col">Onzeker</th>
              <th scope="col">Geëxp.</th>
            </tr>
          </thead>
          <tbody>
            {#each sessionWeeks.slice(0, -1) as w (w.week)}
              <tr>
                <th scope="row">{shortFormat.format(date(w.week))}</th>
                <td>{w.sessions}</td>
                <td>{pct(w.notUnderstood, w.sessions)}</td>
                <td>{pct(w.uncertain, w.sessions)}</td>
                <td>{pct(w.exported, w.sessions)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <p class="muted hint">
          Van wie anonieme cijfers deelt, zonder te zien van wie. Een sessie komt binnen als hij
          geëxporteerd is, of een week na het stoppen; de week is die van binnenkomst. Niet
          begrepen, verbeterd en mislukt: van de uitspraken. Onzeker en nagelopen: van de
          waarnemingen. De rest: van de sessies. Een percentage pas bij {MIN_GROUP} sessies.
        </p>
      </div>
    </section>
  {/if}

  <section class="card">
    <div class="card-head">
      <h2>Gebruikers per dag</h2>
      <span class="muted">laatste {DAYS} dagen</span>
    </div>
    <div class="card-body">
      <div class="chart">
        <span class="max muted">{maxUsers}</span>
        <ol class="days">
          {#each days as d (d.day)}
            <li title={dayLabel(d)} aria-label={dayLabel(d)}>
              <span class="bar" style:height={`${(d.users / maxUsers) * 100}%`}></span>
            </li>
          {/each}
        </ol>
      </div>
      <div class="axis muted">
        <span>{shortFormat.format(date(days[0].day))}</span>
        <span>vandaag</span>
      </div>
    </div>
  </section>

  <section class="card">
    <div class="card-head">
      <h2>Sessies en uitspraken per week</h2>
      <span class="muted">laatste {WEEKS} weken</span>
    </div>
    <div class="card-body">
      <ul class="legend">
        <li>
          <span class="swatch sessions"></span>Sessies
          <strong>{chartWeeks[chartWeeks.length - 1].sessions}</strong>
        </li>
        <li>
          <span class="swatch utterances"></span>Uitspraken
          <strong>{chartWeeks[chartWeeks.length - 1].utterances}</strong>
        </li>
      </ul>
      <div class="chart">
        <span class="max muted">{maxWeek}</span>
        <svg
          class="lines"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Sessies en uitspraken per week; de cijfers staan in de tabel hieronder"
        >
          {#each chartWeeks as w, i (w.week)}
            <rect
              class="week"
              class:selected={selected === w.week}
              x={x(i) - STEP / 2}
              y="0"
              width={STEP}
              height={H}
              role="button"
              tabindex="0"
              aria-label={weekLabel(w)}
              aria-pressed={selected === w.week}
              onclick={() => select(w.week)}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  select(w.week);
                }
              }}
            >
              <title>{weekLabel(w)}</title>
            </rect>
          {/each}
          <polyline class="utterances" points={line('utterances')} />
          <polyline class="sessions" points={line('sessions')} />
          {#each chartWeeks as w, i (w.week)}
            <circle class="utterances" cx={x(i)} cy={y(w.utterances, maxWeek)} r="3" />
            <circle class="sessions" cx={x(i)} cy={y(w.sessions, maxWeek)} r="3" />
          {/each}
        </svg>
      </div>
      <div class="axis muted">
        <span>{shortFormat.format(date(chartWeeks[0].week))}</span>
        <span>deze week</span>
      </div>
    </div>
  </section>

  <section class="card">
    <div class="card-head"><h2>Per week</h2></div>
    <div class="card-body table">
      <table>
        <thead>
          <tr>
            <th scope="col">Week van</th>
            <th scope="col">Actief</th>
            <th scope="col">Nieuw</th>
            <th scope="col">Terug</th>
            <th scope="col">Weg</th>
            <th scope="col">Sessies</th>
            <th scope="col">Uitspr.</th>
          </tr>
        </thead>
        <tbody>
          {#each weeks as w (w.week)}
            <tr id={`week-${w.week}`} class:selected={selected === w.week}>
              <th scope="row">{shortFormat.format(date(w.week))}</th>
              <td>{w.active}</td>
              <td>{w.new}</td>
              <td>{w.returning + w.resumed}</td>
              <td>{w.lapsed}</td>
              <td>{w.sessions}</td>
              <td>{w.utterances}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="muted hint">Terug: eerder al gebruikt. Weg: vorige week actief, deze week niet.</p>
    </div>
  </section>
{:else}
  <p class="muted">Bezig met ophalen…</p>
{/if}

<style>
  .intro {
    margin: 0;
  }

  .owner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 3rem;
  }

  .owner input {
    width: 1.25rem;
    height: 1.25rem;
  }

  .totals {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .totals dt {
    font-size: 0.85rem;
    color: var(--muted);
  }

  .totals dd {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .hint {
    margin: 0.75rem 0 0;
    font-size: 0.85rem;
  }

  .chart {
    position: relative;
    padding-top: 1.25rem;
    border-bottom: 1px solid var(--border);
  }

  .max {
    position: absolute;
    top: 0;
    left: 0;
    font-size: 0.75rem;
  }

  .days {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 8rem;
  }

  .days li {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: flex-end;
  }

  .bar {
    width: 100%;
    border-radius: 4px 4px 0 0;
    background: var(--brand);
  }

  .legend {
    margin: 0 0 0.5rem;
    padding: 0;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1.25rem;
    font-size: 0.85rem;
  }

  .legend li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .legend strong {
    font-variant-numeric: tabular-nums;
  }

  .swatch {
    width: 1rem;
    height: 3px;
    border-radius: 2px;
  }

  .lines {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .lines polyline {
    pointer-events: none;
    fill: none;
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .lines circle {
    pointer-events: none;
    stroke: var(--surface);
    stroke-width: 2;
  }

  .lines .week {
    fill: transparent;
    cursor: pointer;
  }

  .lines .week:hover,
  .lines .week:focus-visible {
    fill: var(--bg);
  }

  .lines .week:focus:not(:focus-visible) {
    outline: none;
  }

  .lines .week.selected {
    fill: color-mix(in srgb, var(--brand) 18%, transparent);
  }

  tr.total {
    font-weight: 600;
  }

  tr.selected {
    background: color-mix(in srgb, var(--brand) 18%, transparent);
    font-weight: 600;
  }

  .swatch.sessions,
  .lines circle.sessions {
    background: var(--brand-strong);
    fill: var(--brand-strong);
  }

  .lines polyline.sessions {
    stroke: var(--brand-strong);
  }

  .swatch.utterances,
  .lines circle.utterances {
    background: var(--breast);
    fill: var(--breast);
  }

  .lines polyline.utterances {
    stroke: var(--breast);
  }

  .axis {
    display: flex;
    justify-content: space-between;
    margin-top: 0.25rem;
    font-size: 0.75rem;
  }

  .table {
    overflow-x: auto;
  }

  .facts {
    margin: 0 0 1rem;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem 1rem;
  }

  .facts dt {
    font-size: 0.8rem;
    color: var(--muted);
  }

  .facts dd {
    margin: 0;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .steps {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .steps li {
    display: grid;
    grid-template-columns: 1fr auto 3.5rem;
    gap: 0.5rem;
    padding: 0.4rem 0;
    border-bottom: 1px solid var(--border);
    font-variant-numeric: tabular-nums;
  }

  .steps li span:last-child,
  .steps strong {
    text-align: right;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
  }

  th,
  td {
    padding: 0.35rem 0.2rem;
    text-align: right;
    border-bottom: 1px solid var(--border);
  }

  th:first-child {
    text-align: left;
    font-weight: 400;
    white-space: nowrap;
  }

  thead th {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--muted);
  }
</style>
