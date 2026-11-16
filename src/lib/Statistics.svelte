<script lang="ts">
  // Statistieken, alleen voor de eigenaar: hoeveel mensen de app gebruiken en
  // of ze terugkomen (src/lib/stats.ts). Alleen totalen, geen namen: wie wat
  // deed staat al op Developer, hier gaat het om de trend.
  import { listActivity } from './api';
  import { perDay, perWeek, type ActivityRow } from './stats';

  const DAYS = 30;
  const WEEKS = 8;
  const CHART_WEEKS = 12;
  // Grafiek per week: vaste maat, schaalt mee met de breedte van de kaart
  const W = 320;
  const H = 120;
  const PAD = 6;
  const STEP = (W - 2 * PAD) / (CHART_WEEKS - 1);

  let rows = $state<ActivityRow[]>();
  let error = $state('');
  let withOwner = $state(false);

  listActivity('2026-01-01')
    .then((result) => (rows = result))
    .catch((e) => (error = `Ophalen mislukt: ${e instanceof Error ? e.message : e}`));

  let counted = $derived((rows ?? []).filter((r) => withOwner || r.tester !== 'eigenaar'));
  let days = $derived(perDay(counted, DAYS));
  let weeks = $derived(perWeek(counted, WEEKS));
  let maxUsers = $derived(Math.max(1, ...days.map((d) => d.users)));
  // Oudste week eerst, voor de grafiek
  let chartWeeks = $derived(perWeek(counted, CHART_WEEKS).reverse());
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
      </p>
    </div>
  </section>

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
      <span class="muted">laatste {CHART_WEEKS} weken</span>
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
            <rect class="week" x={x(i) - STEP / 2} y="0" width={STEP} height={H}>
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
            <tr>
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
  }

  .lines .week:hover {
    fill: var(--bg);
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
