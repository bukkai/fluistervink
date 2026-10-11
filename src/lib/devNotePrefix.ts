// Herkent het voorvoegsel "dev note". Los bestand zonder afhankelijkheden,
// zodat ook scripts/testset.mjs het kan gebruiken.

/**
 * "Dev note, …" aan het begin van een uitspraak, ook zoals spraakherkenning
 * het vaak verstaat ("def note", "devnoot", "Dev. Note:"). Geeft de tekst
 * erna terug, of undefined als het geen dev note is.
 */
export function devNoteText(transcript: string): string | undefined {
  const match = /^\s*(dev|def|deaf)\W*(notes?|noot|nood)\b[\s,:;.!-]*/i.exec(transcript);
  return match ? transcript.slice(match[0].length).trim() : undefined;
}
