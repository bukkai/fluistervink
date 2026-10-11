import { describe, expect, it } from 'vitest';
import { devNoteText } from './devNotePrefix';

describe('devNoteText', () => {
  it.each([
    ['Feedback, de knop is te klein', 'de knop is te klein'],
    ['feed back: trilt niet', 'trilt niet'],
    ['Fluistervink, feedback. Kaart laadt traag', 'Kaart laadt traag'],
    ['Dev note: oude stijl', 'oude stijl'],
    ['def note de knop', 'de knop'],
    ['Dev. Note: met punt', 'met punt'],
    ['devnoot iets', 'iets'],
    ['Feedback', ''],
  ])('herkent %j', (transcript, text) => {
    expect(devNoteText(transcript)).toBe(text);
  });

  it.each([
    'zes overvliegende houtduiven',
    'roepje vink',
    'feedbackloop bij de vink',
    'vink, feedback',
  ])('laat %j met rust', (transcript) => {
    expect(devNoteText(transcript)).toBeUndefined();
  });
});
