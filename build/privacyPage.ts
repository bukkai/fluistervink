// Maakt bij het bouwen een losse privacypagina (/privacy) uit
// src/lib/Privacy.svelte, dezelfde tekst als #privacy in de app. Google Play
// wil een openbaar adres voor het privacybeleid dat zonder de app te lezen is;
// #privacy bestaat alleen in de app (JavaScript, en een # gaat niet naar de
// server). Eén bron, zodat de twee niet uit elkaar lopen.
//
// Gewone HTML met een eigen stylesheet, zonder scripts: past in de
// Content-Security-Policy van public/_headers (geen <style> en geen
// style-attributen).

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import type { Plugin } from 'vite';

const root = join(import.meta.dirname, '..');

// Kop van de losse pagina: het logo met de naam, naar de app
const pageCss = `
body > header {
  background: var(--brand);
  color: var(--on-brand);
}

body > header a {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  max-width: 32rem;
  margin: 0 auto;
  padding: 0.75rem 1rem;
  font-size: 1.35rem;
  font-weight: 700;
  color: inherit;
  text-decoration: none;
}

body > header img {
  border-radius: 0.5rem;
}

body > main {
  max-width: 32rem;
  margin: 0 auto;
  padding: 0 1rem 2rem;
}
`;

export interface PrivacyPage {
  html: string;
  css: string;
}

/** De losse pagina: HTML en de stylesheet (algemene stijl van de app plus die van de pagina). */
export async function renderPrivacyPage(): Promise<PrivacyPage> {
  const source = readFileSync(join(root, 'src/lib/Privacy.svelte'), 'utf8');
  const compiled = compile(source, {
    filename: 'Privacy.svelte',
    generate: 'server',
    css: 'external',
  });

  // De gecompileerde component importeert svelte/internal/server; in
  // node_modules wegschrijven, zodat Node dat vindt.
  const dir = join(root, 'node_modules/.tmp/privacy-page');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `Privacy-${Date.now()}.js`);
  writeFileSync(file, compiled.js.code);
  const { default: Privacy } = await import(/* @vite-ignore */ pathToFileURL(file).href).finally(
    () => rmSync(file),
  );

  const { body } = render(Privacy, { props: { standalone: true } });
  const html = `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <title>Privacy · Fluistervink</title>
    <meta name="description" content="Wat Fluistervink met je opnames, locaties en waarnemingen doet." />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/privacy.css" />
  </head>
  <body>
    <header>
      <a href="/"><img src="/icon.svg" alt="" width="32" height="32" />Fluistervink</a>
    </header>
    <main>
${body}
    </main>
  </body>
</html>
`;
  const appCss = readFileSync(join(root, 'src/app.css'), 'utf8');
  return { html, css: `${appCss}\n${pageCss}\n${compiled.css?.code ?? ''}` };
}

/** Vite-plugin: zet privacy.html en privacy.css naast de app (alleen bij bouwen). */
export function privacyPage(): Plugin {
  return {
    name: 'fluistervink-privacy-page',
    apply: 'build',
    applyToEnvironment: (environment) => environment.name === 'client',
    async generateBundle() {
      const page = await renderPrivacyPage();
      this.emitFile({ type: 'asset', fileName: 'privacy.html', source: page.html });
      this.emitFile({ type: 'asset', fileName: 'privacy.css', source: page.css });
    },
  };
}
