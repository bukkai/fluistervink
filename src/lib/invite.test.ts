import { describe, expect, it } from 'vitest';
import { inviteMail, inviteMailto } from './invite';

const link = 'https://fluistervink.nl/#code=abc_DEF-123';
const code = 'abc_DEF-123';
const play = 'https://play.google.com/apps/internaltest/0000';

describe('inviteMail', () => {
  it('stuurt Android-testers naar Play en geeft de code los', () => {
    const { body } = inviteMail('ans', link, code, play);
    expect(body).toMatch(/^Hoi Ans,/);
    const lines = body.split('\n');
    // Eerst de deelnamelink, dan de code, dan pas de link voor de iPhone
    const playAt = lines.indexOf(play);
    const codeAt = lines.indexOf(code);
    const linkAt = lines.indexOf(link);
    expect(playAt).toBeGreaterThan(0);
    expect(codeAt).toBeGreaterThan(playAt);
    expect(linkAt).toBeGreaterThan(codeAt);
    expect(body).toContain('Instellingen');
    expect(lines[linkAt - 1]).toContain('Safari');
    expect(body).not.toContain('Chrome');
  });

  it('valt zonder Play-link terug op de link in Chrome', () => {
    const { body } = inviteMail('ans', link, code, '');
    expect(body).toContain(link);
    expect(body).toContain('Chrome');
    expect(body).not.toContain('Play');
    expect(body.split('\n')).not.toContain(code);
  });
});

describe('inviteMailto', () => {
  it('codeert spaties als %20 en houdt de link heel', () => {
    const mailto = inviteMailto('a+b@example.com', inviteMail('ans', link, code, play));
    expect(mailto.startsWith('mailto:a%2Bb%40example.com?')).toBe(true);
    expect(mailto).not.toContain('+');
    const params = new URLSearchParams(mailto.slice(mailto.indexOf('?') + 1));
    expect(params.get('subject')).toBe('Uitnodiging: Fluistervink testen');
    expect(params.get('body')).toContain(link);
    expect(params.get('body')).toContain(play);
  });
});
