// Herkent het voorvoegsel "feedback" (vroeger "dev note"). Los bestand zonder
// afhankelijkheden, zodat ook scripts/testset.mjs het kan gebruiken.

/**
 * "Feedback, …" aan het begin van een uitspraak, eventueel na
 * "Fluistervink", ook zoals spraakherkenning het verstaat ("feed back",
 * "Feedback:"). Het oude "dev note" blijft werken ("def note", "devnoot",
 * "Dev. Note:"). Geeft de tekst erna terug, of undefined als het geen
 * feedback is.
 */
export function devNoteText(transcript: string): string | undefined {
  const match =
    /^\s*(?:fluistervink\W*)?(?:feed\W?back|(?:dev|def|deaf)\W*(?:notes?|noot|nood))\b[\s,:;.!-]*/i.exec(
      transcript,
    );
  return match ? transcript.slice(match[0].length).trim() : undefined;
}
