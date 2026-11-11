// Speelt de app nu een opname af ("Laatst verstaan", LastUtterance.svelte)?
// Zolang dat zo is, laat het sessiescherm de volumeknop los, zodat die het
// volume regelt in plaats van een nieuwe opname te starten (feedback 11 nov).
export const playback = $state({ playing: false });
