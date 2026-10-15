import { describe, expect, it } from 'vitest';
import { unzipStored } from '../test-helpers';
import { XLSX_TYPE, buildXlsx, columnName, crc32 } from './xlsx';

describe('buildXlsx', () => {
  it('maakt een werkboek met één werkblad', async () => {
    const blob = buildXlsx([['a'], ['b']]);
    expect(blob.type).toBe(XLSX_TYPE);
    const files = await unzipStored(blob);
    expect([...files.keys()]).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
    ]);
  });

  it('zet tekst als inlineStr en getallen als getal, zoals het voorbeeld van waarneming.nl', async () => {
    const sheet = (
      await unzipStored(
        buildXlsx([
          ['date', 'lat'],
          ['2026-10-15', 52.07],
        ]),
      )
    ).get('xl/worksheets/sheet1.xml');
    expect(sheet).toContain(
      '<c r="A2" t="inlineStr"><is><t xml:space="preserve">2026-10-15</t></is></c>',
    );
    expect(sheet).toContain('<c r="B2" t="n"><v>52.07</v></c>');
  });

  it('laat lege cellen weg en ontsnapt tekens die niet in XML mogen', async () => {
    const sheet = (await unzipStored(buildXlsx([['<a & "b">', '', undefined, 'é\u0007']]))).get(
      'xl/worksheets/sheet1.xml',
    )!;
    expect(sheet).toContain('&lt;a &amp; &quot;b&quot;&gt;');
    expect(sheet).not.toContain('r="B1"');
    expect(sheet).not.toContain('r="C1"');
    expect(sheet).toContain('<t xml:space="preserve">é</t>');
  });
});

describe('columnName', () => {
  it('telt zoals een spreadsheet', () => {
    expect([0, 14, 25, 26, 27, 701].map(columnName)).toEqual(['A', 'O', 'Z', 'AA', 'AB', 'ZZ']);
  });
});

describe('crc32', () => {
  it('geeft de standaardwaarde', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});
