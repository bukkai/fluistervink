// Een eenvoudig xlsx-bestand (één werkblad, alleen tekst en getallen), zonder
// bibliotheek. Voor de export naar waarneming.nl vanuit de Android-app: een
// .csv krijgt daar van Android een type dat het uploadveld van waarneming.nl
// niet accepteert (15 okt), een .xlsx wel. Opgezet als het voorbeeldbestand
// van waarneming.nl: tekst als "inlineStr", getallen als getal.

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Een cel: tekst, of een getal (leeg = geen cel) */
export type Cell = string | number | undefined;

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/** Werkblad met de eerste rij als kolomnamen */
export function buildXlsx(rows: Cell[][], sheetName = 'Sheet1'): Blob {
  const files: [string, string][] = [
    [
      '[Content_Types].xml',
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        `</Types>`,
    ],
    [
      '_rels/.rels',
      `<Relationships xmlns="${PKG}">` +
        `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    ],
    [
      'xl/workbook.xml',
      `<workbook xmlns="${NS}" xmlns:r="${REL}"><sheets>` +
        `<sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>` +
        `</sheets></workbook>`,
    ],
    [
      'xl/_rels/workbook.xml.rels',
      `<Relationships xmlns="${PKG}">` +
        `<Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/>` +
        `</Relationships>`,
    ],
    [
      'xl/styles.xml',
      `<styleSheet xmlns="${NS}">` +
        `<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>` +
        `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
        `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
        `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
        `<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>` +
        `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
        `</styleSheet>`,
    ],
    ['xl/worksheets/sheet1.xml', sheetXml(rows)],
  ];
  const encoder = new TextEncoder();
  return new Blob([zip(files.map(([name, xml]) => [name, encoder.encode(HEAD + xml)]))], {
    type: XLSX_TYPE,
  });
}

function sheetXml(rows: Cell[][]): string {
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          if (value === undefined || value === '') return '';
          const ref = `${columnName(c)}${r + 1}`;
          return typeof value === 'number'
            ? `<c r="${ref}" t="n"><v>${value}</v></c>`
            : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');
  return `<worksheet xmlns="${NS}"><sheetData>${body}</sheetData></worksheet>`;
}

/** 0 → A, 25 → Z, 26 → AA */
export function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

function escapeXml(text: string): string {
  return (
    text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      // Stuurtekens (behalve tab en regeleinden) mogen niet in XML
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  );
}

// Zip zonder compressie ("stored"): een xlsx is een zip, en zo blijft het
// klein en zonder bibliotheek. De bestanden zijn maar een paar kB.

let crcTable: Uint32Array | undefined;

export function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(files: [string, Uint8Array][]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, data] of files) {
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    // Vaste datum (1 jan 1980): dezelfde inhoud geeft hetzelfde bestand
    const header = new DataView(new ArrayBuffer(30));
    header.setUint32(0, 0x04034b50, true);
    header.setUint16(4, 20, true); // versie nodig om uit te pakken
    header.setUint16(8, 0, true); // geen compressie
    header.setUint16(12, 0x21, true); // datum: 1980-01-01
    header.setUint32(14, crc, true);
    header.setUint32(18, data.length, true);
    header.setUint32(22, data.length, true);
    header.setUint16(26, nameBytes.length, true);
    local.push(new Uint8Array(header.buffer), nameBytes, data);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(14, 0x21, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, nameBytes.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const parts = [...local, ...central, new Uint8Array(end.buffer)];
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    result.set(part, at);
    at += part.length;
  }
  return result;
}
