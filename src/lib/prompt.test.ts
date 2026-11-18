import { describe, expect, it } from 'vitest';
import { MAX_OPTIONAL_PARAMETERS, promptVersionFor, toolsFor } from './prompt';

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
