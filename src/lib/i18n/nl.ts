import type { Entry } from './index';

// Nederlandse teksten: de bron voor elke andere taal (zie index.ts).
// Sleutels per scherm; `{naam}` wordt ingevuld door `t()`, en een tekst met
// `one` en `other` telt met `{n}`. Een tekst die in een zin om een link of
// nadruk heen staat, is in stukken geknipt (`…Voor`, `…Link`, `…Na`).

export const nl = {
  // Gedeeld
  'common.back': 'Terug',
  'common.save': 'Opslaan',
  'common.busy': 'Bezig…',
  'common.later': 'Later',
  'common.ok': 'Oké',
  'common.sessions': { one: '1 sessie', other: '{n} sessies' },
  'common.recordings': { one: '1 opname', other: '{n} opnames' },
  'common.and': '{a} en {b}',
  'common.defaultSessionName': 'Vogelsessie',
  'common.today': 'vandaag',

  // Opmaak (format.ts, sessions.ts)
  'format.moment': '{day} {time}',
  'format.durationHours': '{h} u {m} min',
  'format.durationMinutes': '{m} min',

  // Kop en menu (App.svelte)
  'menu.open': 'Menu',
  'menu.close': 'Menu sluiten',
  'menu.sessions': 'Vorige sessies',
  'menu.howItWorks': 'Hoe werkt het?',
  'menu.feedback': 'Feedback',
  'menu.feedbackUnsent': 'Feedback ({n})',
  'menu.settings': 'Instellingen',
  'menu.privacy': 'Privacy',
  'app.dormantTitle': 'Fluistervink is in een ander venster geopend',
  'app.dormantText': 'Gebruik de app op één plek tegelijk, anders zitten ze elkaar in de weg.',
  'app.dormantContinue': 'Hier verder',
  'app.since': 'Sinds {time}',
  'app.stop': 'Stop',
  'app.confirmStop': 'Sessie stoppen?',

  // Startscherm (Home.svelte)
  'home.title': 'Klaar om te gaan vogelen?',
  'home.introVoor':
    'Waar je ook bent: lopend, op de fiets, in de vogelhut of in de tuin. Zie of hoor je iets, druk dan op de knop en zeg het, bijvoorbeeld',
  'home.introExample1': '"zes overvliegende houtduiven"',
  'home.introOf': 'of',
  'home.introExample2': '"roepje vink"',
  'home.installProblem': 'De app kon zich niet aanmelden ({problem}). Probeer het later opnieuw.',
  'home.staleStopped':
    'Je sessie van {moment} stond nog aan. Na 8 uur zonder uitspraken is hij vanzelf gestopt.',
  'home.view': 'Bekijken',
  'home.toSessions': 'Naar de sessies',
  'home.shareTitle': 'Delen met de ontwikkelaar?',
  'home.shareText':
    'Fluistervink is nog in ontwikkeling. Mag de app na elke sessie je uitspraken (als tekst), wat de app ervan maakte, je correcties en feedback, en de locaties van je waarnemingen naar de ontwikkelaar sturen? Opnames niet, tenzij je dat bij Instellingen aanzet. Alleen de ontwikkelaar kan het lezen; je kunt het altijd weer uitzetten.',
  'home.privacyLink': 'Meer over privacy',
  'home.shareYes': 'Ja, delen',
  'home.shareNo': 'Liever niet',
  'home.start': 'Begin met vogelen',
  'home.tip': 'Nog nooit gedaan? Probeer het in de tuin of bij het raam: één merel is genoeg.',
  'home.lastSession': 'Laatste sessie',

  // Herinnering aan de export (exportReminder.ts)
  'reminder.unreviewed': {
    one: '1 sessie van meer dan een week geleden is nog niet nagelopen.',
    other: '{n} sessies van meer dan een week geleden zijn nog niet nagelopen.',
  },
  'reminder.ready': {
    one: '1 sessie staat al een week klaar voor waarneming.nl',
    other: '{n} sessies staan al een week klaar voor waarneming.nl',
  },
  'reminder.readyEnd': '{text}.',
  'reminder.readyAndUnreviewed': '{text}, {n} nog niet nagelopen.',

  // Nog aan het vogelen? (StillBirding.svelte)
  'stillBirding.title': 'Ben je nog aan het vogelen?',
  'stillBirding.text': 'Sinds {moment} is er niets ingesproken.',
  'stillBirding.keep': 'Ja, ga door',
  'stillBirding.stop': 'Nee, stoppen',

  // Bijwerken (UpdateStatus.svelte)
  'update.loading': 'Nieuwe versie laden…',
  'update.updatedTo': 'Bijgewerkt naar versie {version}',
  'update.whatsNew': 'Wat is er nieuw?',

  // Instellingen (Settings.svelte)
  'settings.title': 'Instellingen',
  'settings.nameTitle': 'Je naam',
  'settings.nameLabel': 'Naam (niet verplicht)',
  'settings.nameHint':
    'Alleen voor de ontwikkelaar, zodat die weet van wie gebruik en feedback komen. Leeg laten en opslaan haalt je naam weg.',
  'settings.nameSaved': 'Opgeslagen.',
  'settings.nameRemoved': 'Naam weggehaald.',
  'settings.saveFailed': 'Opslaan mislukt: {error}',
  'settings.version': 'versie {version}',
  'settings.androidApp': 'Android-app {version}',
  'settings.ownerCode': 'Code van de ontwikkelaar',
  'settings.codeLabel': 'Code',
  'settings.codeHint':
    'Alleen voor de ontwikkelaar; de app werkt zonder code. Leeg laten en opslaan haalt de code weg.',
  'settings.saveAndTest': 'Opslaan en testen',
  'settings.connectedAs': 'Verbonden als {tester}.',
  'settings.connected': 'Verbonden met de proxy.',
  'settings.wrongCode': 'Code klopt niet.',
  'settings.signInFailed': 'Aanmelden lukt niet: {error}',
  'settings.proxyUnreachable': 'Proxy niet bereikbaar.',

  // Keuzes (PreferenceSettings.svelte)
  'prefs.groupSpeaking': 'Inspreken',
  'prefs.groupReview': 'Nalopen en export',
  'prefs.soortgroepen': 'Ook andere dieren inspreken',
  'prefs.soortgroepenHint':
    'Naast vogels ook zoogdieren, reptielen en amfibieën, dagvlinders en libellen ("twee reeën", "een pad", "een atalanta"). Ze gaan mee naar waarneming.nl; eBird neemt alleen vogels. Uit: de app kiest alleen vogels, wat bij korte namen als "das" of "vos" een vergissing scheelt.',
  'prefs.volumeknop': 'Volumeknop als inspreekknop',
  'prefs.volumeknopHint':
    'Tijdens een sessie start een druk op de volumeknop (omhoog of omlaag) een opname, en de volgende druk stopt hem. Handig met handschoenen of met de verrekijker in je andere hand; een Bluetooth-knopje voor selfies werkt ook zo. Het volume regel je tijdens een sessie dan niet met die knop. Werkt alleen met de app op het scherm, niet met het scherm uit.',
  'prefs.gesproken': 'Gesproken bevestiging in de oortjes (proef)',
  'prefs.gesprokenHint':
    'Na het trillen zegt de app wat hij heeft vastgelegd ("houtduif, 6, overvliegend"). Alleen als er oortjes of een headset aan zitten, nooit via de luidspreker. Een podcast gaat even zachter.',
  'prefs.zeldzaamOnzeker': 'Zeldzame soort wordt onzeker',
  'prefs.zeldzaamOnzekerHint':
    'Kiest de app een soort die bij waarneming.nl zeldzaam of zeer zeldzaam is, dan wordt de waarneming onzeker, zodat je hem thuis bovenaan ziet. Meestal is het een verwisseling met een gewone soort.',
  'prefs.exportHerinnering': 'Herinnering aan de export',
  'prefs.exportHerinneringHint':
    'Staan sessies een week klaar voor waarneming.nl, of wachten ze al een week om nagelopen te worden, dan zie je een melding op het hoofdscherm. Met "Later" drie dagen niet.',
  'prefs.ebird': 'Ik gebruik eBird',
  'prefs.ebirdHint':
    'Na het stoppen vraagt de app of je alles hebt genoteerd, en bij een sessie staat een kaartje eBird met de duur en de afstand. Bij Sessies exporteer je de nagelopen sessies in één bestand, dat je zelf bij eBird uploadt. Sessies van vóór het aanzetten doen alleen mee als je de vraag erbij beantwoordt.',

  // Back-up (BackupSettings.svelte)
  'backup.title': 'Back-up',
  'backup.hint':
    'Je sessies staan alleen op dit apparaat. Een back-up bewaart ze als bestand, zodat je ze kunt terugzetten op een nieuwe telefoon of als de app verwijderd was. Zet het bestand ergens anders neer (Drive, je computer) om echt veilig te zijn. Opnames gaan alleen mee van sessies die je nog niet hebt nagelopen.',
  'backup.hintNative':
    'Je sessies staan alleen op dit apparaat. Een back-up bewaart ze als bestand in Downloads, zodat je ze kunt terugzetten op een nieuwe telefoon of als de app verwijderd was. Zet het bestand ergens anders neer (Drive, je computer) om echt veilig te zijn. Opnames gaan alleen mee van sessies die je nog niet hebt nagelopen.',
  'backup.last': 'Laatste back-up: {date}.',
  'backup.since': 'Sindsdien {sessions} erbij.',
  'backup.noneYetOf': 'Nog geen back-up gemaakt van je {sessions}.',
  'backup.noneYet': 'Nog geen back-up gemaakt.',
  'backup.make': 'Back-up maken',
  'backup.restore': 'Back-up terugzetten',
  'backup.restoreHint':
    'Terugzetten voegt alleen sessies toe die hier nog niet staan; wat er al is, blijft zoals het is. Instellingen gaan niet mee.',
  'backup.savedIn': 'Opgeslagen in {folder}.',
  'backup.downloaded': 'Back-up gedownload.',
  'backup.failed': 'Back-up mislukt: {error}',
  'backup.restoreFailed': 'Terugzetten mislukt: {error}',

  // Delen (ShareSettings.svelte)
  'share.title': 'Delen met de ontwikkelaar',
  'share.hintVoor':
    'Na elke sessie gaan de uitspraken, wat de app ervan maakte, je correcties bij het nalopen en je feedback naar de ontwikkelaar, om de herkenning te verbeteren. Ook de locaties van je waarnemingen. Zie',
  'share.hintNa': '.',
  'share.sessions': 'Sessies en feedback delen',
  'share.audio': 'Ook de opnames (helpt om de spraakherkenning te vergelijken)',
  'share.now': 'Nu versturen',
  'share.sent': '{what} verstuurd.',
  'share.allSent': 'Alles was al verstuurd.',
  'share.failed': 'Versturen mislukt: {error}',
  'share.lastSent': 'Laatst verstuurd: {date}.',
  'share.nothingSent': 'Nog niets verstuurd.',

  // Opnames (RecordingSettings.svelte, recordings.ts)
  'recordings.title': 'Opnames',
  'recordings.hint':
    'De app bewaart wat je inspreekt op je telefoon, zodat je het thuis kunt terugluisteren. Wis je de opnames, dan blijven de sessies, wat je zei als tekst en de waarnemingen gewoon staan. Per sessie kan het ook, onderaan bij die sessie.',
  'recordings.onDevice': 'Op dit apparaat: {recordings}.',
  'recordings.deleteAll': 'Alle opnames wissen',
  'recordings.none': 'Er staan geen opnames op dit apparaat.',
  'recordings.deleted': '{recordings} gewist.',
  'recordings.scopeAll': 'van alle sessies',
  'recordings.describe': '{recordings} ({size})',
  'recordings.confirmDelete':
    '{recordings} {scope} wissen? Wat je zei blijft als tekst staan, net als de waarnemingen. Terugluisteren kan daarna niet meer.',
  'recordings.sharedAll': {
    one: 'Die is al gedeeld met de ontwikkelaar; daar blijft dat staan. Wil je dat ook weg, vraag het dan als feedback.',
    other:
      'Ze zijn al gedeeld met de ontwikkelaar; daar blijft dat staan. Wil je dat ook weg, vraag het dan als feedback.',
  },
  'recordings.sharedSome': {
    one: '1 ervan is al gedeeld met de ontwikkelaar; daar blijft dat staan. Wil je dat ook weg, vraag het dan als feedback.',
    other:
      '{n} ervan zijn al gedeeld met de ontwikkelaar; daar blijft dat staan. Wil je dat ook weg, vraag het dan als feedback.',
  },

  // Trektelmodus (TrektelSettings.svelte)
  'trektel.title': 'Trektelmodus',
  'trektel.label': 'Trektelmodus (proef)',
  'trektel.hint1':
    'Voor als je op één plek telt en de telefoon naast je legt. Tijdens een sessie verschijnt dan de knop "Trektelling starten": de app luistert daarna door en verwerkt alles wat je zegt, zonder dat je steeds hoeft te drukken. Stilte wordt niet verstuurd.',
  'trektel.hint2':
    'Het scherm blijft aan zolang de telling loopt, dat kost accu. Ga je even naar een andere app (zoals Merlin) of gaat het scherm op slot, dan pauzeert de telling: de microfoon gaat uit (één lange tril) en weer aan als je terugkomt. Na een kwartier weg stopt de telling (twee lange trillen), en na vier uur stopt hij vanzelf.',
  'trektel.hint3':
    'Per dag verwerkt de app hooguit 5 uur spraak. Daarboven stopt de telling; wat je daarna nog inspreekt, blijft bewaard en kun je de volgende dag met "Opnieuw" laten verwerken.',
} satisfies Record<string, Entry>;
