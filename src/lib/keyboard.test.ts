import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isTextField, watchKeyboard, type KeyboardClosed } from './keyboard';

// Nagebootst zichtbaar deel van het scherm: krimpt als het toetsenbord opengaat
class FakeViewport extends EventTarget {
  height = 800;
  resize(height: number) {
    this.height = height;
    this.dispatchEvent(new Event('resize'));
  }
}

describe('isTextField', () => {
  it('telt tekstvelden, niet vinkjes en knoppen', () => {
    const text = document.createElement('input');
    const number = Object.assign(document.createElement('input'), { type: 'number' });
    const check = Object.assign(document.createElement('input'), { type: 'checkbox' });
    expect(isTextField(text)).toBe(true);
    expect(isTextField(number)).toBe(true);
    expect(isTextField(document.createElement('textarea'))).toBe(true);
    expect(isTextField(check)).toBe(false);
    expect(isTextField(document.createElement('select'))).toBe(false);
    expect(isTextField(null)).toBe(false);
  });
});

describe('watchKeyboard', () => {
  let viewport: FakeViewport;
  let field: HTMLInputElement;
  let onTyping: ReturnType<typeof vi.fn<(typing: boolean) => void>>;
  let onClosed: ReturnType<typeof vi.fn<(sizes: KeyboardClosed) => void>>;
  let stop: () => void;

  beforeEach(() => {
    viewport = new FakeViewport();
    field = document.createElement('input');
    document.body.append(field);
    onTyping = vi.fn();
    onClosed = vi.fn();
    stop = watchKeyboard(onTyping, onClosed, viewport as unknown as VisualViewport);
  });

  afterEach(() => {
    stop();
    field.remove();
  });

  it('meldt typen bij het aantikken van een veld', () => {
    field.focus();
    expect(onTyping).toHaveBeenLastCalledWith(true);
  });

  it('laat het veld los als het toetsenbord dichtgaat', () => {
    field.focus();
    viewport.resize(450); // toetsenbord open
    viewport.resize(790); // weer dicht, focus nog op het veld
    expect(onClosed).toHaveBeenCalledWith({ before: 800, smallest: 450, height: 790 });
    expect(document.activeElement).not.toBe(field);
  });

  it('laat niet los bij groei zonder dat het toetsenbord open was (13 nov)', () => {
    field.focus();
    viewport.resize(760);
    viewport.resize(800);
    expect(onClosed).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(field);
  });

  it('meldt na het loslaten weer niet-typen', async () => {
    field.focus();
    field.blur();
    await Promise.resolve();
    expect(onTyping).toHaveBeenLastCalledWith(false);
  });

  it('luistert na het stoppen niet meer', () => {
    stop();
    field.focus();
    expect(onTyping).not.toHaveBeenCalled();
  });
});
