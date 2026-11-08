import { describe, expect, it } from 'vitest';
import { renderPrivacyPage } from './privacyPage.ts';

describe('losse privacypagina', () => {
  it('heeft de tekst van #privacy, met contact en links naar de app', async () => {
    const { html, css } = await renderPrivacyPage();
    expect(html).toContain('<h2 class="page-title">Privacy</h2>');
    expect(html).toContain('href="mailto:info@fluistervink.nl"');
    // Schermen van de app via de voorpagina, niet /privacy#instellingen
    expect(html).toContain('href="/#instellingen"');
    expect(html).not.toMatch(/href="#/);
    // Geen Terug-knop: er is geen vorige pagina in de app
    expect(html).not.toContain('class="back"');
    expect(css).toContain('--brand');
  });

  it('past in de Content-Security-Policy: geen scripts en geen inline stijl', async () => {
    const { html } = await renderPrivacyPage();
    expect(html).not.toMatch(/<script|<style|style="/);
  });
});
