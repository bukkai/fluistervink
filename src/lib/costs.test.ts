import { describe, expect, it } from 'vitest';
import { checkBill, rowCost, startOfLastMonth, summarize, type UsageRow } from './costs';

function row(fields: Partial<UsageRow>): UsageRow {
  return {
    day: '2026-10-24',
    tester: 'anna',
    channel: 'beta',
    session: 'wandeling-1',
    model: 'claude-haiku-5-5',
    requests: 1,
    inputTokens: 0,
    outputTokens: 0,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    audioSeconds: 0,
    ...fields,
  };
}

// Midden op de dag in Nederland
const now = new Date('2026-10-24T12:00:00+02:00');

describe('rowCost', () => {
  it('rekent elke soort token tegen zijn eigen prijs', () => {
    const cost = rowCost(
      row({
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        cacheWriteTokens: 1_000_000,
        cacheReadTokens: 1_000_000,
      }),
    );
    expect(cost).toBeCloseTo(0.1 + 0.5 + 0.125 + 0.01);
  });

  it('rekent whisper-1 per minuut audio', () => {
    expect(rowCost(row({ model: 'whisper-1', audioSeconds: 120 }))).toBeCloseTo(0.012);
  });

  it('kent geen prijs voor een onbekend model', () => {
    expect(rowCost(row({ model: 'claude-nieuw' }))).toBeUndefined();
  });
});

describe('summarize', () => {
  const rows = [
    // Vorige maand
    row({ day: '2026-09-30', session: 'oud', inputTokens: 10_000_000 }), // $1
    // Deze maand, anna: wandeling 1 (2 uitspraken), vandaag
    row({ model: 'gpt-4o-transcribe', requests: 2, inputTokens: 400_000 }), // $1
    row({ requests: 2, inputTokens: 20_000_000 }), // $2
    // piet, eerder deze maand
    row({
      day: '2026-10-02',
      tester: 'piet',
      session: 'wandeling-2',
      model: 'gpt-4o-transcribe',
      requests: 1,
      inputTokens: 200_000,
    }), // $0,50
    // De testset van de eigenaar, zonder wandeling
    row({ day: '2026-10-10', tester: 'eigenaar', session: '', inputTokens: 40_000_000 }), // $4
    row({ model: 'claude-nieuw', inputTokens: 1 }),
  ];
  const summary = summarize(rows, now);

  it('telt vandaag, deze maand en vorige maand', () => {
    expect(summary.today).toBeCloseTo(3);
    expect(summary.thisMonth).toBeCloseTo(7.5);
    expect(summary.lastMonth).toBeCloseTo(1);
    expect(summary.openai).toBeCloseTo(1.5);
    expect(summary.anthropic).toBeCloseTo(6);
  });

  it('geeft per tester de kosten en uitspraken van deze maand, duurste eerst', () => {
    expect(summary.perTester).toEqual([
      { tester: 'eigenaar', cost: expect.closeTo(4), utterances: 0 },
      { tester: 'anna', cost: expect.closeTo(3), utterances: 2 },
      { tester: 'piet', cost: expect.closeTo(0.5), utterances: 1 },
    ]);
  });

  it('middelt per uitspraak en per wandeling (zonder de testset)', () => {
    expect(summary.perUtterance).toBeCloseTo((3 + 0.5) / 3);
    expect(summary.perWalk).toBeCloseTo((3 + 0.5) / 2);
  });

  it('zet de duurste wandelingen bovenaan, ook die van vorige maand', () => {
    expect(summary.topWalks.map((w) => [w.session, w.utterances])).toEqual([
      ['wandeling-1', 2],
      ['oud', 0],
      ['wandeling-2', 1],
    ]);
  });

  it('noemt modellen zonder prijs', () => {
    expect(summary.unknownModels).toEqual(['claude-nieuw']);
  });
});

describe('startOfLastMonth', () => {
  it('gaat over de jaargrens', () => {
    expect(startOfLastMonth(new Date('2026-01-15T12:00:00Z'))).toBe('2025-12-01');
    expect(startOfLastMonth(now)).toBe('2026-09-01');
  });

  it('rekent in Nederlandse tijd', () => {
    // 1 nov 00:30 in Nederland is nog 31 okt in UTC
    expect(startOfLastMonth(new Date('2026-10-31T23:30:00Z'))).toBe('2026-10-01');
  });
});

describe('checkBill', () => {
  const bill = {
    month: '2026-10',
    days: { '2026-10-02': 5, '2026-10-23': 0.3, '2026-10-24': 0.2 },
    fetchedAt: 0,
  };

  it('vergelijkt vanaf de eerste getelde dag, per aanbieder', () => {
    const rows = [
      row({ day: '2026-10-23', inputTokens: 1_000_000 }),
      row({ day: '2026-10-24', outputTokens: 1_000_000 }),
      row({ day: '2026-10-24', model: 'whisper-1', audioSeconds: 600 }),
      row({ day: '2026-09-30', inputTokens: 10_000_000 }),
    ];
    const check = checkBill(rows, bill, 'anthropic');
    expect(check.since).toBe('2026-10-23');
    expect(check.counted).toBeCloseTo(0.6);
    expect(check.billed).toBeCloseTo(0.5);
    expect(checkBill(rows, bill, 'openai').counted).toBeCloseTo(0.06);
  });

  it('neemt de hele maand als er nog niets geteld is', () => {
    expect(checkBill([], bill, 'openai')).toEqual({ since: '2026-10-01', counted: 0, billed: 5.5 });
  });
});
