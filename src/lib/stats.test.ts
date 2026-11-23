import { describe, expect, it } from 'vitest';
import type { UsageRow } from './costs';
import {
  addDays,
  cohorts,
  costPerKind,
  costPerUserWeek,
  costSplit,
  funnel,
  limitPeaks,
  monthForecast,
  perDay,
  perWeek,
  topShare,
  unitCostPerWeek,
  utterancesPerLanguage,
  versionsInUse,
  weekOf,
  type ActivityRow,
} from './stats';

const row = (day: string, tester: string, sessions = 1, utterances = 5): ActivityRow => ({
  day,
  tester,
  sessions,
  utterances,
});

// Zondag 8 november 2026, 's middags in Nederland
const now = new Date('2026-11-08T12:00:00Z');

describe('weekOf en addDays', () => {
  it('geeft de maandag, ook over een maand- en zomertijdgrens', () => {
    expect(weekOf('2026-11-08')).toBe('2026-11-02');
    expect(weekOf('2026-11-02')).toBe('2026-11-02');
    expect(weekOf('2026-11-01')).toBe('2026-10-26');
    expect(addDays('2026-10-24', 7)).toBe('2026-10-31');
  });
});

describe('perDay', () => {
  it('telt gebruikers per dag en vult lege dagen aan', () => {
    const days = perDay(
      [row('2026-11-07', 'anna', 2, 10), row('2026-11-07', 'bert'), row('2026-01-01', 'anna')],
      3,
      now,
    );
    expect(days).toEqual([
      { day: '2026-11-06', users: 0, sessions: 0, utterances: 0 },
      { day: '2026-11-07', users: 2, sessions: 3, utterances: 15 },
      { day: '2026-11-08', users: 0, sessions: 0, utterances: 0 },
    ]);
  });
});

describe('perWeek', () => {
  it('onderscheidt nieuw, terugkerend, terug na pauze en weggevallen', () => {
    const weeks = perWeek(
      [
        row('2026-10-14', 'carla'), // week van 12 okt
        row('2026-10-27', 'anna'), // week van 26 okt
        row('2026-10-28', 'bert'),
        row('2026-11-03', 'anna'), // week van 2 nov
        row('2026-11-05', 'anna'),
        row('2026-11-04', 'carla'),
        row('2026-11-08', 'dirk'),
      ],
      2,
      now,
    );
    expect(weeks[0]).toEqual({
      week: '2026-11-02',
      active: 3,
      new: 1,
      returning: 1,
      resumed: 1,
      lapsed: 1,
      sessions: 4,
      utterances: 20,
    });
    expect(weeks[1]).toMatchObject({ week: '2026-10-26', active: 2, new: 2, returning: 0 });
  });
});

describe('costPerUserWeek', () => {
  // gpt-transcribe: $0,0045 per minuut; 60 s audio = $0,0045
  const usage = (
    day: string,
    tester: string,
    seconds: number,
    session = 's',
    model = 'gpt-transcribe',
  ): UsageRow => ({
    day,
    tester,
    channel: 'stable',
    session,
    model,
    requests: 1,
    inputTokens: 0,
    outputTokens: 0,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    audioSeconds: seconds,
  });
  const cent = 0.0045;

  it('rekent gemiddelde, mediaan en hoogste per week, zonder eigenaar en testset', () => {
    const weeks = costPerUserWeek(
      [
        usage('2026-11-03', 'anna', 60),
        usage('2026-11-04', 'bert', 120),
        usage('2026-11-05', 'carla', 600),
        usage('2026-11-05', 'eigenaar', 6000),
        usage('2026-11-05', 'anna', 6000, ''),
        usage('2026-10-28', 'anna', 60),
      ],
      '2026-10-26',
      now,
    );
    expect(weeks.map((w) => w.week)).toEqual(['2026-11-02', '2026-10-26']);
    const [week] = weeks;
    expect(week.current).toBe(true);
    expect(week.users).toBe(3);
    expect(week.cost).toBeCloseTo(13 * cent);
    expect(week.perUser).toBeCloseTo((13 * cent) / 3);
    expect(week.median).toBeCloseTo(2 * cent);
    expect(week.max).toBeCloseTo(10 * cent);
    expect(weeks[1]).toMatchObject({ current: false, users: 1 });
  });

  it('telt alleen hele weken vanaf de eerste opgehaalde dag', () => {
    const weeks = costPerUserWeek([], '2026-10-01', now);
    expect(weeks.at(-1)?.week).toBe('2026-10-05');
    expect(weeks.every((w) => w.users === 0 && w.perUser === 0)).toBe(true);
  });

  it('telt alleen wie iets insprak als actief, wel met de kosten van het model', () => {
    const weeks = costPerUserWeek(
      [
        usage('2026-11-03', 'anna', 60),
        { ...usage('2026-11-03', 'anna', 0, 's', 'claude-haiku-5-5'), outputTokens: 1_000_000 },
        { ...usage('2026-11-03', 'bert', 0, 's', 'claude-haiku-5-5'), outputTokens: 1_000_000 },
      ],
      '2026-11-02',
      now,
    );
    expect(weeks[0].users).toBe(1);
    expect(weeks[0].cost).toBeCloseTo(cent + 0.5);
  });
});

/** Een regel uit de usage-tabel; standaard één uitspraak van een minuut */
const use = (day: string, tester: string, extra: Partial<UsageRow> = {}): UsageRow => ({
  day,
  tester,
  channel: 'stable',
  session: 's',
  model: 'gpt-transcribe',
  requests: 1,
  inputTokens: 0,
  outputTokens: 0,
  cacheWriteTokens: 0,
  cacheReadTokens: 0,
  audioSeconds: 60,
  ...extra,
});

describe('cohorts', () => {
  it('rekent per week van eerste gebruik het deel dat later nog actief is', () => {
    // Week van 28 sep: anna en bert beginnen; anna komt een week later terug, bert na vier
    const result = cohorts(
      [
        row('2026-09-28', 'anna'),
        row('2026-09-29', 'bert'),
        row('2026-10-05', 'anna'),
        row('2026-10-26', 'bert'),
        row('2026-11-03', 'cor'),
      ],
      now,
    );
    expect(result.map((c) => [c.week, c.size])).toEqual([
      ['2026-11-02', 1],
      ['2026-09-28', 2],
    ]);
    // 1 week: anna; 2 weken: niemand; 4 weken (26 okt): bert; 8 weken: nog niet om
    expect(result[1].retained).toEqual([0.5, 0, 0.5, undefined]);
    // Deze week begonnen: nog niets te zeggen
    expect(result[0].retained).toEqual([undefined, undefined, undefined, undefined]);
  });
});

describe('funnel', () => {
  it('telt van installeren tot blijven, alleen voor installaties', () => {
    const result = funnel(
      [
        row('2026-09-01', 'app-a', 1),
        row('2026-10-01', 'app-a', 1), // na 4 weken nog actief
        row('2026-09-01', 'app-b', 2), // twee sessies, daarna niet meer
        row('2026-11-07', 'app-c', 1), // te kort geleden begonnen
        row('2026-09-01', 'anna', 3), // oude testercode: geen installatie
        row('2026-09-01', 'eigenaar', 3),
      ],
      ['app-a', 'app-b', 'app-c', 'app-d', 'eigenaar'],
      now,
    );
    expect(result).toEqual({ installed: 4, used: 3, returned: 2, eligible: 2, stayed: 1 });
  });
});

describe('monthForecast', () => {
  it('rekent de maand door naar het eind', () => {
    // 8 november: $8 na 8 dagen wordt $30 in een maand van 30 dagen
    expect(monthForecast(8, now)).toBe(30);
  });
});

describe('topShare', () => {
  it('geeft het deel van de duurste 10%, zonder eigenaar en testset', () => {
    const rows = [
      ...Array.from({ length: 9 }, (_, i) => use('2026-11-03', `app-${i}`)),
      use('2026-11-03', 'app-duur', { audioSeconds: 60 * 11 }),
      use('2026-11-03', 'eigenaar', { audioSeconds: 6000 }),
      use('2026-11-03', 'app-0', { session: '', audioSeconds: 6000 }),
      use('2026-10-03', 'app-0', { audioSeconds: 6000 }),
    ];
    const result = topShare(rows, now)!;
    expect(result.users).toBe(10);
    expect(result.top).toBe(1);
    expect(result.share).toBeCloseTo(11 / 20);
  });

  it('geeft niets zonder kosten', () => {
    expect(topShare([], now)).toBeUndefined();
  });
});

describe('costSplit', () => {
  it('verdeelt de kosten van deze maand over omgeving en aanmelding', () => {
    const split = costSplit(
      [
        use('2026-11-03', 'app-a'),
        use('2026-11-03', 'app-b', { channel: 'beta' }),
        use('2026-11-03', 'eigenaar', { channel: 'beta' }),
        use('2026-11-03', 'app-a', { session: '' }),
      ],
      new Map([
        ['app-a', 'play'],
        ['app-b', 'turnstile'],
      ]),
      now,
    );
    expect(split.channel).toEqual({ stable: 0.0045, beta: 0.009 });
    expect(split.via).toEqual({ play: 0.0045, turnstile: 0.0045, eigenaar: 0.0045 });
  });
});

describe('unitCostPerWeek', () => {
  it('rekent kosten per uitspraak en het deel uit de cache', () => {
    const weeks = unitCostPerWeek(
      [
        use('2026-11-03', 'app-a', { requests: 2, audioSeconds: 120 }),
        use('2026-11-03', 'app-a', {
          model: 'claude-haiku-5-5',
          requests: 2,
          audioSeconds: 0,
          inputTokens: 1000,
          cacheReadTokens: 3000,
        }),
        use('2026-11-03', 'eigenaar', { session: '' }),
      ],
      '2026-10-01',
      now,
    );
    expect(weeks).toHaveLength(1);
    expect(weeks[0].week).toBe('2026-11-02');
    expect(weeks[0].utterances).toBe(2);
    expect(weeks[0].cacheShare).toBe(0.75);
    // 2 minuten spraak plus 1000 × $0,10 en 3000 × $0,01 per miljoen tokens
    expect(weeks[0].perUtterance).toBeCloseTo((0.009 + 0.0001 + 0.00003) / 2);
  });
});

describe('limitPeaks', () => {
  it('geeft de drukste dag per installatie en hoe vaak een plafond geraakt werd', () => {
    const peaks = limitPeaks(
      [
        use('2026-11-03', 'app-a', { model: 'claude-haiku-5-5', requests: 120, audioSeconds: 0 }),
        use('2026-11-03', 'app-a', { audioSeconds: 3600 }),
        use('2026-11-04', 'app-b', { model: 'claude-haiku-5-5', requests: 500, audioSeconds: 0 }),
        use('2026-11-04', 'eigenaar', {
          model: 'claude-haiku-5-5',
          requests: 900,
          audioSeconds: 0,
        }),
        use('2026-10-04', 'app-c', { audioSeconds: 20000 }),
      ],
      now,
    );
    expect(peaks).toEqual({ messages: 500, audioSeconds: 3600, hits: 1 });
  });
});

describe('per soort uitspraak, versie en taal', () => {
  const rows = [
    use('2026-11-03', 'app-a', { kind: 'knop', version: 'aaa1111', language: 'nl' }),
    use('2026-11-03', 'app-a', {
      kind: 'trektel',
      version: 'aaa1111',
      language: 'nl',
      requests: 2,
      audioSeconds: 600,
    }),
    use('2026-11-07', 'app-b', {
      kind: 'proberen',
      session: '',
      version: 'bbb2222',
      language: 'en',
    }),
    use('2026-11-07', 'app-c', { version: 'bbb2222' }),
    // De testset en de eigenaar tellen niet mee
    use('2026-11-07', 'eigenaar', { kind: 'knop', version: 'ccc3333', audioSeconds: 6000 }),
    use('2026-11-07', 'eigenaar', { session: '', audioSeconds: 6000 }),
  ];

  it('rekent de kosten per functie, duurste eerst', () => {
    const kinds = costPerKind(rows, now);
    expect(kinds.map((k) => [k.kind, k.utterances])).toEqual([
      ['trektel', 2],
      ['knop', 1],
      ['proberen', 1],
      ['', 1],
    ]);
    // Tien minuten spraak over twee stukken
    expect(kinds[0].perUtterance).toBeCloseTo(0.0225);
  });

  it('telt installaties per versie, nieuwste eerst', () => {
    expect(versionsInUse(rows, 7, now)).toEqual([
      { version: 'bbb2222', installs: 2, lastDay: '2026-11-07' },
      { version: 'aaa1111', installs: 1, lastDay: '2026-11-03' },
    ]);
  });

  it('telt uitspraken per taal', () => {
    expect(utterancesPerLanguage(rows, now)).toEqual({ nl: 3, en: 1, '': 1 });
  });
});
