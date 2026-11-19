import { describe, expect, it } from 'vitest';
import { MAX_OPTIONAL_PARAMETERS, promptVersionFor, toolsFor, variant } from './prompt';
import { englishAliases } from './promptEn';
import { species } from './vocab';

describe('tools', () => {
  it.each([false, true])('blijven onder de grens van optionele velden (soortgroepen: %s)', (g) => {
    let optional = 0;
    for (const tool of toolsFor(g)) {
      const schema = tool.input_schema as { properties?: object; required?: string[] };
      optional += Object.keys(schema.properties ?? {}).length - (schema.required?.length ?? 0);
    }
    expect(optional).toBeLessThanOrEqual(MAX_OPTIONAL_PARAMETERS);
  });

  // Een verplicht veld achter de optionele: dan liet het model de plek weg en
  // stopte het in een trektelstuk na een gezegde plek (feedback 16 nov)
  it.each([false, true])('zetten verplichte velden voor de optionele (soortgroepen: %s)', (g) => {
    for (const tool of toolsFor(g)) {
      const schema = tool.input_schema as { properties?: object; required?: string[] };
      const keys = Object.keys(schema.properties ?? {});
      const required = schema.required ?? [];
      expect(keys.slice(0, required.length), tool.name).toEqual(required);
    }
  });
});

describe('andere soortgroepen', () => {
  it('laat de prompt zonder de optie ongemoeid: alleen vogelcodes in de tools', async () => {
    expect(await promptVersionFor(true)).not.toBe(await promptVersionFor(false));
    const activityEnum = (withGroups: boolean) => {
      const add = toolsFor(withGroups).find((t) => t.name === 'add_observation')!;
      const props = add.input_schema.properties as Record<string, { enum?: number[] }>;
      return props.activity_id.enum!;
    };
    // 15 = ter plaatse bij zoogdieren
    expect(activityEnum(false)).not.toContain(15);
    expect(activityEnum(true)).toContain(15);
  });
});

describe('Engelse prompt (ontwikkeloptie English)', () => {
  /** De tools zonder beschrijvingen: het schema moet in beide talen gelijk zijn */
  const schema = (tools: ReturnType<typeof toolsFor>) =>
    JSON.parse(
      JSON.stringify(tools, (key, value) => (key === 'description' ? undefined : value)),
    ) as unknown;

  it.each([false, true])('heeft dezelfde tools als het Nederlands (soortgroepen: %s)', (g) => {
    expect(schema(toolsFor(g, 'en'))).toEqual(schema(toolsFor(g)));
  });

  it.each([false, true])('vertaalt elke beschrijving (soortgroepen: %s)', (g) => {
    const dutch = JSON.stringify(toolsFor(g));
    const english = JSON.stringify(toolsFor(g, 'en'));
    for (const word of ['Nederlandse', 'soortenlijst', 'gebruiker', 'waarneming ']) {
      expect(dutch).toContain(word);
      expect(english).not.toContain(word);
    }
  });

  it('heeft een eigen promptversie; de Nederlandse blijven gelijk', async () => {
    const versions = await Promise.all([
      promptVersionFor(false),
      promptVersionFor(true),
      promptVersionFor(false, 'en'),
      promptVersionFor(true, 'en'),
    ]);
    expect(new Set(versions).size).toBe(4);
  });

  it('heeft Engelse soortnamen met dezelfde ID’s, en Engelse codes', () => {
    const { system } = variant(true, 'en');
    expect(system).toContain('127|Brambling|Fringilla montifringilla');
    expect(system).toContain('6 flying over');
    expect(system).toContain('2 real count; 6 estimated');
    expect(system).toContain('### Mammals');
    expect(system).not.toContain('Je bent');
    expect(system).not.toContain('Houtduif');
  });

  it('heeft eBird-namen en korte vormen als bijnamen', () => {
    const names = (name: string) =>
      englishAliases(species).find(({ s }) => s.name === name)?.names ?? [];
    expect(names('Parelduiker')).toContain('Arctic Loon');
    expect(names('Roodborst')).toContain('Robin');
    expect(names('Winterkoning')).toContain('Wren');
    // "Gull" kan van alles zijn
    expect(names('Stormmeeuw')).not.toContain('Gull');
  });
});
