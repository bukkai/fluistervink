// Maakt het icoon en het opstartscherm van de Android-app uit public/icon.svg,
// in alle formaten die Android vraagt (android/app/src/main/res).
//
//   npm run app-icons
//
// Daarna is een nieuwe app-versie nodig: de iconen zitten in de app zelf.
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const RES = 'android/app/src/main/res';
const BACKGROUND = '#f4f1ed';

const icon = await readFile('public/icon.svg', 'utf8');
const vink = icon.match(/<g transform[\s\S]*<\/g>/)[0];

// Adaptief icoon (Android 8+): een voorgrond van 108 dp op een effen
// achtergrond. Android toont alleen het middendeel (72 dp, twee derde) en
// snijdt dat rond, vierkant of als druppel af. De vierkante tekening van
// icon.svg komt dus in dat middendeel; lijf en rug lopen door tot de rand.
const foreground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-128 -128 768 768">${vink}</svg>`;

const svg = (source, size) =>
  sharp(Buffer.from(source), { density: 72 * Math.ceil(size / 128) }).resize(size, size);

const rounded = async (size, radius) =>
  svg(icon, size)
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}"/></svg>`,
        ),
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer();

// Dichtheden: 1 dp is zoveel pixels.
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

for (const [name, scale] of Object.entries(DENSITIES)) {
  const dir = `${RES}/mipmap-${name}`;
  const legacy = Math.round(48 * scale); // Android 7 en ouder
  await sharp(await rounded(legacy, legacy * 0.12)).toFile(`${dir}/ic_launcher.png`);
  await sharp(await rounded(legacy, legacy / 2)).toFile(`${dir}/ic_launcher_round.png`);
  await svg(foreground, Math.round(108 * scale))
    .png()
    .toFile(`${dir}/ic_launcher_foreground.png`);
}

// Achtergrondkleur van het adaptieve icoon (en van het opstartscherm).
await writeFile(
  `${RES}/values/ic_launcher_background.xml`,
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${BACKGROUND.toUpperCase()}</color>
</resources>
`,
);

// Opstartscherm: het icoon als afgeronde tegel in het midden, op de lichte
// achtergrond. Vanaf Android 12 toont het systeem zelf het adaptieve icoon
// (windowSplashScreenBackground in styles.xml); dit plaatje komt daarna in
// beeld zolang de app laadt, en op oudere Android-versies.
const splash = async (file, width, height) => {
  const tile = Math.round(Math.min(width, height) * 0.4);
  await sharp({
    create: { width, height, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: await rounded(tile, tile * 0.22), gravity: 'center' }])
    .png()
    .toFile(file);
};

const SPLASH = {
  mdpi: [320, 480],
  hdpi: [480, 800],
  xhdpi: [720, 1280],
  xxhdpi: [960, 1600],
  xxxhdpi: [1280, 1920],
};
await splash(`${RES}/drawable/splash.png`, 480, 320);
for (const [name, [w, h]] of Object.entries(SPLASH)) {
  await splash(`${RES}/drawable-port-${name}/splash.png`, w, h);
  await splash(`${RES}/drawable-land-${name}/splash.png`, h, w);
}
