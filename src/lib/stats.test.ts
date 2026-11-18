import { describe, expect, it } from 'vitest';
import type { UsageRow } from './costs';
import { addDays, costPerUserWeek, perDay, perWeek, weekOf, type ActivityRow } from './stats';

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
