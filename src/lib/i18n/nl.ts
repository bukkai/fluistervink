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
  'app.tuintelLeft': 'Tuintelling, nog {time}',

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
  'home.startTuintel': 'Tuintelling: een half uur tellen',
  'home.tip': 'Nog nooit gedaan? Probeer het in de tuin of bij het raam: één merel is genoeg.',
  'home.lastSession': 'Laatste sessie',

  // Welkom (Welcome.svelte, welcome.ts)
  'welcome.title': 'Welkom bij Fluistervink',
  'welcome.lead':
    'Zeg onderweg wat je ziet of hoort. Fluistervink schrijft mee, zodat jij kunt blijven kijken en luisteren.',
  'welcome.howTalk': 'Druk op de knop en zeg het gewoon:',
  'welcome.howTalkExample': '"drie merels"',
  'welcome.howTrill': 'Eén korte tril: opgeslagen. Je hoeft niet naar het scherm te kijken.',
  'welcome.howHome': 'Thuis loop je de lijst na en zet je hem door naar waarneming.nl.',
  'welcome.permissionsTitle': 'Microfoon en locatie',
  'welcome.permissionsLeadBefore': 'Je telefoon vraagt de eerste keer of de app je',
  'welcome.microphone': 'microfoon',
  'welcome.and': 'en',
  'welcome.location': 'locatie',
  'welcome.permissionsLeadAfter':
    ' mag gebruiken. Geef dat nu alvast, dan komt die vraag niet midden in je eerste waarneming.',
  'welcome.permissionsHint':
    'De microfoon staat alleen aan als jij op de knop drukt. De locatie zorgt dat elke waarneming op de goede plek komt.',
  'welcome.permissionsHintApp':
    'Tijdens het vogelen staat er een melding van Fluistervink; daardoor werkt de app door als je telefoon in je zak zit.',
  'welcome.microphoneStatus': 'Microfoon: {status}',
  'welcome.locationStatus': 'Locatie: {status}',
  'welcome.granted': 'in orde',
  'welcome.denied': 'geen toestemming',
  'welcome.permissionsMissing':
    'Zonder microfoon kun je niets inspreken, zonder locatie komen je waarnemingen niet op de kaart. Aanzetten kan alsnog bij {path}.',
  'welcome.settingsPathApp': 'Instellingen van je telefoon → Apps → Fluistervink → Rechten',
  'welcome.settingsPathBrowser': 'Chrome: tik op het icoontje links van het adres → Rechten',
  'welcome.tryTitle': 'Probeer het eens',
  'welcome.tryLead': 'Zeg iets alsof je buiten staat, bijvoorbeeld',
  'welcome.tryExample': '"drie merels en een zingende roodborst"',
  'welcome.tryNothingSaved': 'Er wordt niets bewaard.',
  'welcome.shareTitle': 'Help je mee?',
  'welcome.shareLead':
    'Fluistervink is nog in ontwikkeling, en het werk van één ontwikkelaar, Stephan. Wat jij inspreekt en verbetert, laat zien waar de app nog misgaat.',
  'welcome.shareText':
    'Mag de app na elke sessie je uitspraken (als tekst), wat de app ervan maakte, je correcties en feedback, en de locaties van je waarnemingen naar de ontwikkelaar sturen? Opnames niet, tenzij je dat bij Instellingen aanzet. Alleen de ontwikkelaar kan het lezen, en je kunt het altijd weer uitzetten.',
  'welcome.asking': 'Even wachten…',
  'welcome.allow': 'Toestemming geven',
  'welcome.start': 'Aan de slag',
  'welcome.next': 'Verder',
  'welcome.skip': 'Overslaan',
  'welcome.step': 'Stap {i} van {n}',

  // Probeer het eens (TryOut.svelte, tryout.ts)
  'tryout.listening': 'Even luisteren…',
  'tryout.recording': 'Klaar? Tik nog eens · {s} s',
  'tryout.starting': 'Microfoon aanzetten…',
  'tryout.again': 'Nog een keer',
  'tryout.tap': 'Tik en zeg het',
  'tryout.trillNothing': 'Twee korte trillen: niets herkend. Zeg het nog eens.',
  'tryout.trillUncertain':
    'Een korte en een lange tril: in een sessie betekent dat opgeslagen, maar onzeker. Die loop je thuis na.',
  'tryout.trillSaved': 'Eén korte tril: in een sessie betekent dat opgeslagen.',
  'tryout.micDenied': 'De app mag de microfoon niet gebruiken. Aanzetten kan bij {path}.',
  'tryout.unsupported': 'Deze browser kan niet opnemen.',
  'tryout.heard': 'Fluistervink verstond:',
  'tryout.heardNothing': 'Fluistervink verstond niets.',
  'tryout.uncertain': 'onzeker',
  'tryout.note': 'Dit was een proef: er is niets bewaard.',
  'tryout.or': ' of ',
  'tryout.audioLimit': 'Voor vandaag is het maximum aan spraak bereikt. Morgen kan het weer.',
  'tryout.messageLimit':
    'Voor vandaag is het maximum aantal uitspraken bereikt. Morgen kan het weer.',
  'tryout.failed': 'Dat lukte even niet. Probeer het nog eens.',
  'tryout.offline': 'Je hebt nu geen verbinding. Probeer het als je weer online bent.',

  // Wat is er nieuw? (Changelog.svelte)
  'changelog.title': 'Wat is er nieuw?',
  'changelog.inDutch': 'De wijzigingen staan alleen in het Nederlands.',
  'changelog.version': 'Je hebt versie {version}',

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
  'prefs.groupUnderstanding': 'Wat de app verstaat',
  'prefs.groupField': 'Bediening in het veld',
  'prefs.groupCounting': 'Tellen',
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
  'prefs.schermAan': 'Scherm aan houden tijdens een sessie',
  'prefs.schermAanHint':
    'Het scherm gaat niet vanzelf uit zolang een sessie loopt, zoals bij een recepten-app. Zo kun je met de volumeknop blijven inspreken zonder te ontgrendelen. Kost meer accu; met de aan-uitknop zet je het scherm gewoon op slot.',
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
  'trektel.label': 'Trektelmodus',
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
  'log.trektelBacklog':
    'Je trektelling liep door: alles uit de afgelopen {minutes} minuten is binnen en wordt nu verwerkt.',
  'log.observations': 'Waarnemingen',
  'log.speciesCount': { one: '1 soort', other: '{n} soorten' },
  'log.observationCount': { one: '1 waarneming', other: '{n} waarnemingen' },
  'log.onlyUncertain': 'Alleen onzeker ({n})',
  'log.edit': 'Waarneming aanpassen',
  'log.reviewed': 'Nagelopen',
  'log.uncertain': 'Onzeker',
  'log.uncertainBecause': 'Onzeker: {reason}',
  'log.note': 'Notitie: {note}',
  'log.changedByVoice': 'Met de stem aangepast, was: {was}',
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
  'log.notUnderstood': 'Niet begrepen ({n})',
  'log.notUnderstoodHint':
    'Hierin vond de app geen waarneming. Luister ze terug: zat er toch een vogel in, maak er dan een waarneming van.',
  'log.rescue': 'Maak er een waarneming van',
  'log.dismiss': 'Geen waarneming',
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
  'sessions.filedAway': {
    one: '1 afgehandelde sessie van meer dan een week geleden',
    other: '{n} afgehandelde sessies van meer dan een week geleden',
  },
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

  // Tuintelling (TuintelResult.svelte, tuintelling.ts)
  'tuintel.title': 'Tuintelling',
  'tuintel.introVoor':
    'Per soort het hoogste aantal dat je in één keer noemde, zoals Vogelbescherming het vraagt. Geef het zelf door op',
  'tuintel.introNa': ', samen met de datum en de begintijd.',
  'tuintel.started': 'Begonnen op {date} om {time}',
  'tuintel.none': 'Geen vogels in de tuin geteld. Ook een telling zonder vogels kun je doorgeven.',
  'tuintel.extraTitle': 'Zelf toevoegen met "vogelsoort toevoegen"',
  'tuintel.unknownTitle': 'Kies eerst een soort',
  'tuintel.unknownText':
    'Deze kun je zo niet doorgeven. Tik in de lijst hieronder op de waarneming en kies de soort, of vink hem uit.',
  'tuintel.flyoversTitle': 'Overvliegend, telt niet mee',
  'tuintel.uncertain': 'onzeker',
  'tuintel.uncertainHint':
    'Loop de onzekere eerst na: een ingestuurde telling kun je niet meer verbeteren.',
  'tuintel.copy': 'Kopiëren',
  'tuintel.copied': 'Gekopieerd',
  'tuintel.copyHeader': 'Tuintelling {date}, begonnen om {time}',
  'tuintel.copyExtra': 'Zelf toevoegen:',
  'tuintel.open': 'Naar het telformulier',

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
  'summary.reviewedIn': {
    one: '1 waarneming, nagelopen in {time}',
    other: '{n} waarnemingen, nagelopen in {time}',
  },
  'summary.minutes': { one: '1 minuut', other: '{n} minuten' },
  'summary.underAMinute': 'minder dan een minuut',
  // Bewerkformulier (ObservationEditor.svelte)
  'editor.species': 'Soort',
  'editor.speciesList': 'Soorten',
  'editor.count': 'Aantal',
  'editor.chooseSpecies': 'Kies een soort uit de lijst.',
  'editor.activity': 'Gedrag',
  'editor.method': 'Methode',
  'editor.lifeStage': 'Kleed/leeftijd',
  'editor.sex': 'Geslacht',
  'editor.countingMethod': 'Telmethode',
  'editor.more': 'Meer',
  'editor.location': 'Locatie',
  'editor.placeByVoice': 'volgens de uitspraak, ±{m} m',
  'editor.placeByHand': 'met de hand gezet (±{m} m)',
  'editor.placeGps': 'GPS, ±{m} m',
  'editor.changeLocation': 'Locatie aanpassen',
  'editor.spoken': 'Gezegd: {text}',
  'editor.backToRecorded': 'Terug naar de opgenomen plek',
  'editor.backToRecordedNone': 'Terug naar de opgenomen plek (geen locatie)',
  'editor.privateNote': 'Eigen notitie (gaat niet mee in de export)',
  'editor.remarks': 'Opmerking voor waarneming.nl',
  'editor.uncertain': 'Onzeker',
  'editor.uncertainBecause': 'Onzeker ({reason})',
  'editor.copy': 'Kopiëren',
  'editor.delete': 'Verwijderen',
  'editor.gone':
    'Deze waarneming is intussen verwijderd, bijvoorbeeld met de stem. Terugzetten kan onder "Verwijderd" bij de sessie.',
  'editor.cancel': 'Annuleren',

  // Plek kiezen (LocationPicker.svelte, PlaceUnplaced.svelte)
  'picker.markerTitle': 'Plek van de waarneming (te verslepen)',
  'picker.tilesFailed':
    'De kaart laadt niet. "Huidige locatie" werkt wel; op de kaart tikken kan later, als je weer bereik hebt.',
  'picker.tilesFailedOffline':
    'De kaart laadt niet: geen bereik. "Huidige locatie" werkt wel; op de kaart tikken kan later, als je weer bereik hebt.',
  'picker.hint': 'Tik op de kaart of sleep de stip naar de plek van de vogel.',
  'picker.locating': 'Plek zoeken…',
  'picker.here': 'Huidige locatie',
  'unplaced.question': {
    one: 'Waar stond je? De waarneming zonder plek komt daar te staan.',
    other: 'Waar stond je? Alle {n} waarnemingen zonder plek komen daar te staan.',
  },
  'unplaced.choose': { one: 'Plek kiezen', other: 'Plek kiezen voor alle {n}' },

  // Kaart van een sessie (ObservationMap.svelte)
  'map.zoomIn': 'Inzoomen',
  'map.uncertain': '(onzeker)',
  'map.uncertainTitle': 'onzeker',
  'map.mapsApp': 'kaarten-app',
  'map.accuracy': '± {m} m · ',
  'map.clusterCount': '{n} waarnemingen',
  'map.clusterCountScreenReader': ' waarnemingen',
  'map.withoutLocation': {
    one: '1 waarneming zonder locatie staat niet op de kaart.',
    other: '{n} waarnemingen zonder locatie staan niet op de kaart.',
  },
  'map.reload': 'Kaart opnieuw laden',

  // Soortgroepen (vocab.ts)
  'group.1': 'Vogels',
  'group.2': 'Zoogdieren',
  'group.3': 'Reptielen en amfibieën',
  'group.4': 'Dagvlinders',
  'group.5': 'Libellen',

  // Zeldzaamheid (rarity.ts)
  'rarity.1': 'algemeen',
  'rarity.2': 'vrij algemeen',
  'rarity.3': 'zeldzaam',
  'rarity.4': 'zeer zeldzaam',
  // eBird bij een sessie (EbirdEffort.svelte, ChecklistAnswers.svelte)
  'ebird.title': 'eBird',
  'ebird.duration': 'Duur',
  'ebird.minutes': '{n} min',
  'ebird.protocol': 'Soort telling',
  'ebird.protocolAutomatic': 'Automatisch: {protocol}',
  'ebird.protocol.Stationary': 'Op één plek (Stationary)',
  'ebird.protocol.Traveling': 'Onderweg (Traveling)',
  'ebird.protocol.Incidental': 'Losse waarnemingen (Incidental)',
  'ebird.distance': 'Afstand in km',
  'ebird.distancePlaceholder': 'bv. 3,5',
  'ebird.miles': '{miles} mijl voor eBird.',
  'ebird.measured': 'Gemeten: {km} km.',
  'ebird.backToMeasured': 'Terug naar gemeten',
  'ebird.notMeasured': 'Niet gemeten (sessie van vóór 11 november).',
  'ebird.skip': 'Deze sessie hoeft niet naar eBird',
  'ebird.skipHint': 'Hij telt dan niet mee bij "Exporteren voor eBird" op het scherm Sessies.',
  'ebird.exportedOn': 'Geëxporteerd op {date}.',
  'ebird.answerFirst': 'Beantwoord eerst de vraag hierboven.',
  'ebird.importHintVoor': 'Importeer het bestand bij',
  'ebird.importHintNa':
    'en kies daar bij Format "eBird Record Format (Extended)": eBird zet zelf het andere formaat aan, en dan mislukt de import met "Missing location name". Soorten die eBird niet herkent, kies je daar zelf.',
  'checklist.complete': 'Heb je alles genoteerd wat je kon herkennen?',
  'checklist.completeHint':
    'Dat betekent niet dat je elke vogel telde, wel dat je geen soort bewust wegliet.',
  'checklist.observers': 'Aantal waarnemers',
  'checklist.fewer': 'Eén minder',
  'checklist.more': 'Eén meer',

  // Na een export (waarnemingExport.ts, ebirdExport.ts)
  'export.continue': 'Toch exporteren?',
  'export.saveFailed': 'Opslaan mislukt: {error}',
  'export.savedIn': 'Het bestand staat in {folder}.',
  'export.excluded': '{n} uitgevinkt en niet geëxporteerd.',
  'export.noneWithLocation': 'Geen waarnemingen met een locatie om te exporteren.',
  'export.uncertain': {
    one: '1 waarneming is nog onzeker en gaat mee als "niet zeker".',
    other: '{n} waarnemingen zijn nog onzeker en gaan mee als "niet zeker".',
  },
  'export.earlierThis':
    'Deze sessie is al eerder geëxporteerd. Waarneming.nl weigert de hele import als er een waarneming in zit die al is ingevoerd.',
  'export.earlierSome':
    '{n} van deze sessies zijn al eerder geëxporteerd. Waarneming.nl weigert de hele import als er een waarneming in zit die al is ingevoerd.',
  'export.done': {
    one: '1 waarneming geëxporteerd.',
    other: '{n} waarnemingen geëxporteerd.',
  },
  'export.doneFromSessions': {
    one: '1 waarneming uit {sessions} sessies geëxporteerd.',
    other: '{n} waarnemingen uit {sessions} sessies geëxporteerd.',
  },
  'export.skippedNoLocation': '{n} zonder locatie overgeslagen; voer die met de hand in.',
  'ebirdExport.sessionPrefix': '{name}: ',
  'ebirdExport.defaultSessionName': 'Sessie',
  'ebirdExport.needComplete': '{prefix}vul eerst in of je alles hebt genoteerd.',
  'ebirdExport.needDistance': '{prefix}een lopende telling heeft een afstand nodig.',
  'ebirdExport.long':
    '{prefix}langer dan 8 km. eBird raadt kortere lopende tellingen aan; je kunt hem bij eBird nog opsplitsen.',
  'ebirdExport.midnight': '{prefix}loopt over middernacht en wordt één checklist op de begindatum.',
  'ebirdExport.uncertain': {
    one: '1 waarneming is nog onzeker. eBird kent geen "niet zeker": ze gaan mee als gewone waarneming.',
    other:
      '{n} waarnemingen zijn nog onzeker. eBird kent geen "niet zeker": ze gaan mee als gewone waarneming.',
  },
  'ebirdExport.notReady': 'Nog niet klaar voor eBird:',
  'ebirdExport.none': 'Geen waarnemingen om te exporteren.',
  'ebirdExport.earlierThis':
    'Deze sessie is al eerder voor eBird geëxporteerd. Importeer hem niet twee keer.',
  'ebirdExport.earlierSome':
    '{n} van deze sessies zijn al eerder voor eBird geëxporteerd. Importeer hem niet twee keer.',
  'ebirdExport.done': {
    one: '1 soort geëxporteerd voor eBird.',
    other: '{n} soorten geëxporteerd voor eBird.',
  },
  'ebirdExport.notBirds': {
    one: '1 waarneming van andere dieren niet meegenomen: eBird is alleen voor vogels.',
    other: '{n} waarnemingen van andere dieren niet meegenomen: eBird is alleen voor vogels.',
  },

  // Back-up terugzetten (export.ts)
  'import.none': 'Geen nieuwe sessies gevonden.',
  'import.added': {
    one: '1 sessie teruggezet, te vinden bij Vorige sessies.',
    other: '{n} sessies teruggezet, te vinden bij Vorige sessies.',
  },
  'import.skipped': { one: '1 stond er al.', other: '{n} stonden er al.' },
  'import.feedback': '{n}× losse feedback teruggezet.',
  'import.notOurs': 'Dit is geen export van Fluistervink.',
  'import.invalid': 'Ongeldige export: {what}',
  // Feedback (DevNotes.svelte)
  'notes.title': 'Feedback',
  'notes.copy': 'Kopieer als Markdown',
  'notes.copied': 'Gekopieerd ✓',
  'notes.introVoor': 'Wat viel je op aan de app? Typ het hieronder.',
  'notes.introSharing':
    'Feedback gaat meteen naar de ontwikkelaar, of tijdens een sessie na het stoppen.',
  'notes.introNotSharingVoor': 'Feedback gaat naar de ontwikkelaar als je delen aanzet (',
  'notes.introNotSharingNa': ').',
  'notes.introNa': 'Verstuurde feedback blijft hier staan; weghalen kan altijd.',
  'notes.placeholder': 'Wat viel je op? Bijvoorbeeld: hij herkende blako niet',
  'notes.label': 'Nieuwe feedback',
  'notes.add': 'Toevoegen',
  'notes.location': 'locatie',
  'notes.sent': 'verstuurd ✓',
  'notes.afterSession': 'gaat mee na de sessie',
  'notes.notSent': 'nog niet verstuurd',
  'notes.none': 'Nog geen feedback.',
  'notes.allSent': 'Alle feedback is verstuurd.',
  'notes.earlier': 'Eerder verstuurd ({n})',
  'notes.confirmDelete': 'Deze feedback weghalen?\n\n"{text}"',

  // Fouten bij verbinding en aanmelden (api.ts, install.ts, queue.ts)
  'error.proxyUnreachable': 'Proxy niet bereikbaar',
  'error.offline': 'Geen internetverbinding',
  'error.captivePortal': 'Geen antwoord van de proxy (inlogpagina van een wifi?)',
  'error.noCodeSignIn': 'Aanmelden zonder code staat uit; vul een code in',
  'error.turnstileLoad': 'Controle van Cloudflare niet te laden',
  'error.turnstileSlow': 'Controle van Cloudflare duurde te lang',
  'error.turnstileFailed': 'Controle van Cloudflare mislukt ({code})',
  'error.transcribePrefix': 'Spraakherkenning: {message}',
  // Foutmeldingen bij een uitspraak (api.ts, interpret.ts, audioMigration.ts).
  // De Nederlandse teksten van de proxy staan ook in worker/index.ts; hier
  // staan ze per status of code, zodat ze in de taal van de app op het scherm komen.
  'error.timeout': 'Time-out: geen antwoord binnen {s} s',
  'error.audioLimit': 'Daglimiet bereikt: vandaag is er al 5 uur ingesproken. Morgen kan het weer.',
  'error.messageLimit':
    'Daglimiet bereikt: vandaag zijn er al heel veel uitspraken verwerkt. Morgen kan het weer.',
  'error.tooMany': 'Te veel verzoeken achter elkaar; probeer het zo opnieuw',
  'error.unauthorized': 'Ongeldige of ontbrekende toegangscode of installatie',
  'error.proxyInternal': 'Interne fout in de proxy',
  'error.refused': 'Verzoek geweigerd (HTTP {status})',
  'error.modelRefused': 'Het model weigerde de uitspraak te verwerken',
  'error.recordingUnreadable': 'Opname niet meer te lezen',
  'error.unknownSpecies': '{tool}: onbekende soort-ID {id}',
  'error.invalidCount': '{tool}: ongeldig aantal {count}',
  'error.invalidAddCount': '{tool}: ongeldig aantal erbij {count}',
  'error.invalidCode': '{tool}: ongeldige code',
  'error.missingSpeciesOrCount': '{tool}: soort of aantal ontbreekt',
  'error.unknownRef': '{tool}: verwijzing #{ref} bestaat niet',
  'error.unknownTool': 'onbekende tool {tool}',

  // Locatie (location.svelte.ts)
  'location.unsupported': 'Deze telefoon of browser geeft geen locatie.',
  'location.denied':
    'De app mag je locatie niet gebruiken. Zet dat aan bij de instellingen van je telefoon.',
  'location.notFound': 'Je plek is niet gevonden. Probeer het buiten nog eens, of tik op de kaart.',
  'location.notFoundOffline':
    'Je plek is niet gevonden: zonder bereik doet de GPS er soms minuten over. Tik op de kaart, of probeer het later nog eens.',

  // Afspelen (player.svelte.ts)
  'player.pause': 'Opname pauzeren',
  'player.play': 'Opname afspelen',

  // Trektelling (trektel.ts, trektelRecorder.svelte.ts)
  'trektel.leave': 'Op een ander scherm stopt de trektelling. Toch weggaan?',
  'trektel.micNotBack':
    'Trektelling gestopt: de microfoon ging niet meer aan. Start de telling opnieuw; wat al ingesproken was, is bewaard.',
  'trektel.micLost':
    'Trektelling gestopt: de microfoon viel weg. Start de telling opnieuw; wat al ingesproken was, is bewaard.',
  'trektel.micFailed': 'De microfoon gaat niet aan.',

  // Waarom de app een waarneming onzeker maakt (applyActions.ts, interpret.ts, spokenPlace.ts)
  'reason.rare': 'Zeldzame soort ({species}): klopt het?',
  'reason.accidental': 'Per ongeluk opgenomen? {s} s opname, verstaan: "{transcript}"',
  'reason.notUnderstood': 'Niet begrepen, verstaan: "{transcript}". Kies de soort',
  'reason.belowOne': '{base} − {minus} kan niet: op 1 gezet',
  'reason.onlyNumber':
    'Alleen "{transcript}" verstaan; misschien "een …" (nieuwe waarneming). Was {count} × {species}',
  'reason.vagrant': 'Dwaalgast, niet in de vaste lijst (gezegd: "{named}")',
  'reason.place': 'Plek gezegd: "{text}"; zet hem op de kaart',

  // Gesproken bevestiging (spoken.ts)
  'spoken.failed': 'Niet gelukt',
  'spoken.ignored': 'Niet begrepen',
  'spoken.note': 'Feedback bewaard',
  'spoken.undone': 'Ongedaan gemaakt',
  'spoken.saved': 'Opgeslagen',
  'spoken.savedUncertain': 'Opgeslagen, onzeker',
  'spoken.deleted': 'weg: {species}',
  'spoken.updated': 'aangepast: {what}',
  'spoken.replaced': '{before} wordt {after}',
  'spoken.changed': '{species}, {before} wordt {after}',
  'spoken.many': '{n} waarnemingen',
  'spoken.manyFlagged': '{n} waarnemingen. Onzeker',
  'spoken.manyUncertain': '{n} waarnemingen, {uncertain} onzeker',
  'spoken.flagged': '{sentence}. Onzeker',
  'spoken.uncertain': 'onzeker',
  'spoken.or': ' of ',
  'spoken.meters': '{m} meter',
  'spoken.kilometers': '{km} kilometer',
  'spoken.direction.N': 'noord',
  'spoken.direction.NO': 'noordoost',
  'spoken.direction.O': 'oost',
  'spoken.direction.ZO': 'zuidoost',
  'spoken.direction.Z': 'zuid',
  'spoken.direction.ZW': 'zuidwest',
  'spoken.direction.W': 'west',
  'spoken.direction.NW': 'noordwest',
  'spoken.caughtUp': { one: 'een uitspraak verwerkt', other: '{n} uitspraken verwerkt' },
  'spoken.caughtUpFailed': '{n} niet gelukt',

  // Zeemeeuwen (Zeemeeuwen.svelte)
  'gulls.label': 'Zeemeeuwen bestaan niet',
  'gulls.shout': 'ZEEMEEUW?!',
  'gulls.notExist': 'Een zeemeeuw bestaat niet.',
  'gulls.which': 'Zilvermeeuw? Kokmeeuw? Stormmeeuw? Grote mantelmeeuw?',
  'gulls.hint': 'Tik om de meeuwen te kalmeren',
} satisfies Record<string, Entry>;
