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
  // Sessiescherm (ActiveSession.svelte)
  'session.gpsAccuracy': 'Locatie ±{m} m',
  'session.gpsSlow': 'Nog geen locatie, inspreken kan gewoon',
  'session.gpsSearching': 'Locatie zoeken…',
  'session.gpsDenied': 'Geen toegang tot locatie. Sta dit toe in de browserinstellingen.',
  'session.gpsUnavailable': 'Locatie niet beschikbaar op dit apparaat.',
  'session.micStarting': 'Microfoon aanzetten…',
  'session.trektelStart': 'Trektelling starten',
  'session.typePlaceholder': 'Of typ: zes overvliegende houtduiven',
  'session.typeLabel': 'Uitspraak typen',
  'session.submit': 'Verwerk',
  'session.talk': 'Inspreken',
  'session.talkStop': 'Stop · {s} s',
  'session.trektelStop': 'Stop trektelling · {clock}',
  'session.trektelPaused': 'Gepauzeerd',
  'session.trektelMicStarting': 'Microfoon aanzetten',
  'session.trektelHearing': 'Hoort spraak',
  'session.trektelListening': 'Luistert',
  'session.trektelSent': { one: '1 stuk verstuurd', other: '{n} stukken verstuurd' },
  'session.micDenied': 'Geen toegang tot de microfoon. Sta dit toe in de browserinstellingen.',
  'session.micUnsupported': 'Opnemen kan niet in deze browser.',
  'session.micFailed': 'De microfoon ging niet aan. Tik nog eens.',
  'session.limitAudio': 'vandaag is er al 5 uur ingesproken, het maximum per dag',
  'session.limitModel': 'vandaag zijn er al heel veel uitspraken verwerkt, het maximum per dag',
  'session.trektelStoppedLimit':
    'Trektelling gestopt: {why}. De stukken blijven bewaard; tik morgen op Opnieuw om ze te laten verwerken.',
  'session.saveFailedFull':
    'De telefoon is vol: de laatste opname kon niet bewaard worden. Maak ruimte vrij (bijvoorbeeld foto’s of oude opnames wissen) en probeer het opnieuw.',
  'session.saveFailed': 'De laatste opname kon niet bewaard worden. Probeer het opnieuw.',
  'session.trektelStoppedSave': 'Trektelling gestopt. {why}',

  // Microfoon (microphoneStatus.svelte.ts)
  'mic.headset': 'Luistert met je oortjes',
  'mic.phone': 'Luistert met de telefoon, niet je oortjes',

  // Lijst met waarnemingen en uitspraken (SessionLog.svelte)
  'log.waiting': {
    one: 'Geen bereik: 1 uitspraak wacht. Ze worden verwerkt zodra er verbinding is.',
    other: 'Geen bereik: {n} uitspraken wachten. Ze worden verwerkt zodra er verbinding is.',
  },
  'log.waitingLong': {
    one: 'Geen bereik, al meer dan 2 uur: 1 uitspraak wacht. Ze worden verwerkt zodra er verbinding is.',
    other:
      'Geen bereik, al meer dan 2 uur: {n} uitspraken wachten. Ze worden verwerkt zodra er verbinding is.',
  },
  'log.retry': 'Probeer opnieuw',
  'log.queued': {
    one: '1 uitspraak in de wachtrij (zie Uitspraken)',
    other: '{n} uitspraken in de wachtrij (zie Uitspraken)',
  },
  'log.observations': 'Waarnemingen',
  'log.speciesCount': { one: '1 soort', other: '{n} soorten' },
  'log.observationCount': { one: '1 waarneming', other: '{n} waarnemingen' },
  'log.onlyUncertain': 'Alleen onzeker ({n})',
  'log.edit': 'Waarneming aanpassen',
  'log.reviewed': 'Nagelopen',
  'log.uncertain': 'Onzeker',
  'log.uncertainBecause': 'Onzeker: {reason}',
  'log.note': 'Notitie: {note}',
  'log.showOnMap': 'Op de kaart laten zien',
  'log.placedByVoice': 'volgens de uitspraak',
  'log.placedByHand': 'met de hand gezet',
  'log.noLocation': 'geen locatie',
  'log.positionOld': 'positie {m} min oud',
  'log.positionLater': 'positie {m} min later',
  'log.discard': 'Weg',
  'log.confirm': 'Klopt',
  'log.export': 'Exporteren',
  'log.noUncertainLeft': 'Geen onzekere waarnemingen meer.',
  'log.empty': 'Nog niets waargenomen. Druk op Inspreken en zeg wat je ziet of hoort.',
  'log.deleted': 'Verwijderd ({n})',
  'log.deletedBy.hand': 'verwijderd met de hand',
  'log.deletedBy.voice': 'verwijderd met de stem',
  'log.deletedBy.undo': 'verwijderd ongedaan gemaakt',
  'log.restore': 'Terugzetten',
  'log.male': 'man',
  'log.female': 'vrouw',
  'log.utterances': 'Uitspraken ({n})',
  'log.utterancesFailed': 'Uitspraken ({n}) · {failed} fout',
  'log.audioDeleted': '(opname gewist)',
  'log.recordingOf': 'Opname van {duration}',
  'log.seconds': '{s} s',
  'log.inBackground': '{duration} (app op achtergrond)',
  'log.again': 'Opnieuw',
  'log.status.feedback': 'feedback',
  'log.status.undone': 'teruggedraaid',
  'log.status.waiting': 'wacht op bereik',
  'log.status.queued': 'in wachtrij',
  'log.status.transcribing': 'verstaan…',
  'log.status.processing': 'bezig…',
  'log.status.failed': 'fout',
  'log.status.ignored': 'niet begrepen',
  'log.status.uncertain': 'onzeker',
  'log.status.done': 'verwerkt',
  // Vorige sessies (PastSessions.svelte)
  'sessions.title': 'Vorige sessies',
  'sessions.cancel': 'Annuleren',
  'sessions.cleanUp': 'Opruimen',
  'sessions.none': 'Nog geen sessies.',
  'sessions.readyForWaarneming': {
    one: '1 sessie klaar voor waarneming.nl',
    other: '{n} sessies klaar voor waarneming.nl',
  },
  'sessions.exportWaarneming': 'Exporteren voor waarneming.nl',
  'sessions.importHintVoor': 'Importeer het bestand bij',
  'sessions.importHintNa':
    ', met de site in het Nederlands (NL, rechtsboven; dat is de standaard): gedrag en methode staan in het Nederlands in het bestand.',
  'sessions.forEbird': { one: '1 sessie voor eBird', other: '{n} sessies voor eBird' },
  'sessions.ebirdQuestion': 'Heb je alles genoteerd wat je kon herkennen?',
  'sessions.yes': 'Ja',
  'sessions.no': 'Nee',
  'sessions.notToEbird': 'Niet naar eBird',
  'sessions.exportEbird': 'Exporteren voor eBird',
  'sessions.answerFirst': {
    one: 'Beantwoord eerst de vraag bij 1 sessie.',
    other: 'Beantwoord eerst de vraag bij {n} sessies.',
  },
  'sessions.ebirdHintVoor': 'Importeer het bestand bij',
  'sessions.ebirdHintNa':
    'en kies daar bij Format "eBird Record Format (Extended)". Soorten die eBird niet herkent, kies je daar zelf.',
  'sessions.selectHint': 'Vink de sessies aan die weg mogen.',
  'sessions.selectAll': 'Alles aanvinken',
  'sessions.selectNone': 'Niets aanvinken',
  'sessions.selectExported': 'Alle geëxporteerde',
  'sessions.selectEmpty': 'Alle lege ({n})',
  'sessions.nothingSelected': 'Niets aangevinkt',
  'sessions.deleteSelected': { one: 'Verwijder 1 sessie', other: 'Verwijder {n} sessies' },
  'sessions.confirmDelete': {
    one: '1 sessie voorgoed verwijderen, met alle waarnemingen en opnames?',
    other: '{n} sessies voorgoed verwijderen, met alle waarnemingen en opnames?',
  },
  'sessions.confirmNotExported': {
    one: 'Eén daarvan is nog niet geëxporteerd.',
    other: '{n} daarvan zijn nog niet geëxporteerd.',
  },
  'sessions.confirmDevNotes': {
    one: '1 feedbackbericht gaat ook weg.',
    other: '{n} feedbackberichten gaan ook weg.',
  },
  'sessions.confirmUnprocessed': {
    one: '1 uitspraak is nog niet verwerkt (bv. geen bereik) en gaat verloren.',
    other: '{n} uitspraken zijn nog niet verwerkt (bv. geen bereik) en gaan verloren.',
  },
  'sessions.utterances': { one: '1 uitspraak', other: '{n} uitspraken' },
  'sessions.devNotes': { one: '1 feedbackbericht', other: '{n} feedbackberichten' },
  'sessions.unprocessed': '{n} niet verwerkt',
  'sessions.badgeWaarneming': 'waarneming.nl ✓',
  'sessions.badgeExported': 'geëxporteerd',
  'sessions.badgeReady': 'klaar',
  'sessions.badgeNotExported': 'niet geëxporteerd',
  'sessions.badgeEbird': 'eBird ✓',
  'sessions.when': '{day}, {time}',

  // Eén sessie nalopen (PastSession.svelte)
  'past.back': 'Sessies',
  'past.confirmResume': 'Deze sessie voortzetten?',
  'past.confirmDelete': 'Sessie voorgoed verwijderen, met alle waarnemingen en opnames?',
  'past.confirmDeleteNotExported':
    'Sessie voorgoed verwijderen, met alle waarnemingen en opnames?\n\nDeze sessie is nog niet geëxporteerd.',
  'recordings.scopeSession': 'van deze sessie',
  'past.renamePrompt':
    'Naam van de sessie (leeg laten = automatisch, uit het gebied met de meeste waarnemingen):',
  'past.confirmReady': {
    one: 'Nog 1 onzekere waarneming. Klopt die ook? Dan wordt hij zeker.',
    other: 'Nog {n} onzekere waarnemingen. Kloppen die ook? Dan worden ze zeker.',
  },
  'past.ebirdQuestionLabel': 'Vraag voor eBird',
  'past.forEbird': 'Voor eBird',
  'past.done': 'Klaar',
  'past.notNow': 'Nu niet',
  'past.savedTitle': '✓ Sessie opgeslagen',
  'past.savedText':
    'Alles staat veilig op je telefoon. Loop de waarnemingen na en zet de sessie klaar voor waarneming.nl.',
  'past.rename': 'Naam wijzigen',
  'past.when': '{date}, {from}–{to}',
  'past.duration': 'Duur',
  'past.species': 'Soorten',
  // Met een zacht afbreekstreepje voor een heel smalle telefoon
  'past.observations': 'Waarne\u00ADmingen',
  'past.uncertainCount': '{n} onzeker',
  'past.readyTitle': 'Klaar met nalopen?',
  'past.exportedOn': 'Geëxporteerd op {date} om {time}.',
  'past.isReady':
    'Deze sessie staat klaar. Exporteer alle klaarstaande sessies in één keer bij Sessies.',
  'past.toSessions': 'Naar Sessies',
  'past.notReadyYet': 'Toch nog niet klaar',
  'past.unprocessed': {
    one: 'Nog 1 uitspraak wacht op verwerking, bijvoorbeeld omdat er geen bereik was. Dat gaat vanzelf zodra er verbinding is; daarna kun je de sessie klaarzetten.',
    other:
      'Nog {n} uitspraken wachten op verwerking, bijvoorbeeld omdat er geen bereik was. Dat gaat vanzelf zodra er verbinding is; daarna kun je de sessie klaarzetten.',
  },
  'past.uncertainLeft': {
    one: 'Nog 1 onzekere waarneming. Loop ze bovenaan na, of tik erop in de lijst.',
    other: 'Nog {n} onzekere waarnemingen. Loop ze bovenaan na, of tik erop in de lijst.',
  },
  'past.allCorrect': 'Alles klopt, klaar voor waarneming.nl',
  'past.allCorrectEbird': 'Alles klopt, klaar voor export',
  'past.readyHint':
    'De waarnemingen gelden dan als nagelopen. Klaargezette sessies exporteer je later in één bestand, bij Sessies.',
  'past.readyHintEbird':
    'De waarnemingen gelden dan als nagelopen. Klaargezette sessies exporteer je later in één bestand voor waarneming.nl en een voor eBird, bij Sessies.',
  'past.exportOnlyThis': 'Alleen deze sessie exporteren',
  'past.exportOnlyThisEbird': 'Alleen deze sessie exporteren voor waarneming.nl',
  'past.importHintVoor': 'Importeer het bestand bij',
  'past.importHintNa': ', met de site in het Nederlands.',
  'past.resume': 'Per ongeluk gestopt? Voortzetten',
  'past.deleteRecordings': 'Alleen de opnames wissen',
  'past.delete': 'Sessie verwijderen',

  // Onzeker nalopen (UncertainReview.svelte)
  'review.title': 'Onzeker nalopen',
  'review.left': 'nog {n}',
  'review.skippedCount': '{n} overgeslagen',
  'review.whichSpecies': 'Welke soort was het?',
  'review.edit': 'Aanpassen',
  'review.skip': 'Overslaan',
  'review.skipped': {
    one: 'Overgeslagen. Pas hem aan in de lijst, of bevestig hem onderaan met "Alles klopt".',
    other: 'Overgeslagen. Pas ze aan in de lijst, of bevestig ze onderaan met "Alles klopt".',
  },
  'review.again': 'Opnieuw langslopen',

  // Samenvatting (SessionSummary.svelte)
  'summary.title': 'Samenvatting',
  'summary.copy': 'Kopiëren',
  'summary.copied': 'Gekopieerd',
  'summary.heading': '{title}, {date}: {n} soorten',
} satisfies Record<string, Entry>;
