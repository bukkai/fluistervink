import type { Dictionary } from './index';

// Engelse teksten (Brits Engels), met dezelfde sleutels als nl.ts: het type
// `Dictionary` meldt een vergeten of verkeerd gespelde sleutel. Geen letterlijke
// vertaling: zoals een Engelse vogelaar het zegt. Eerst alleen achter de
// ontwikkeloptie "English" (docs/plan-engels.md, stap 3).
//
// Woorden die steeds terugkomen: waarneming = observation, uitspraak = voice
// note, opname = recording, nalopen = review, trektelling = migration count,
// inspreken = speak.

export const en: Dictionary = {
  // Gedeeld
  'common.back': 'Back',
  'common.save': 'Save',
  'common.busy': 'Working…',
  'common.later': 'Later',
  'common.ok': 'OK',
  'common.sessions': { one: '1 session', other: '{n} sessions' },
  'common.recordings': { one: '1 recording', other: '{n} recordings' },
  'common.and': '{a} and {b}',
  'common.defaultSessionName': 'Birding session',
  'common.today': 'today',

  // Opmaak
  'format.moment': '{day} {time}',
  'format.durationHours': '{h} h {m} min',
  'format.durationMinutes': '{m} min',

  // Kop en menu
  'menu.open': 'Menu',
  'menu.close': 'Close menu',
  'menu.sessions': 'Past sessions',
  'menu.howItWorks': 'How does it work?',
  'menu.feedback': 'Feedback',
  'menu.feedbackUnsent': 'Feedback ({n})',
  'menu.settings': 'Settings',
  'menu.privacy': 'Privacy',
  'app.dormantTitle': 'Fluistervink is open in another window',
  'app.dormantText': 'Use the app in one place at a time, otherwise they get in each other’s way.',
  'app.dormantContinue': 'Continue here',
  'app.since': 'Since {time}',
  'app.stop': 'Stop',
  'app.confirmStop': 'Stop the session?',

  // Startscherm
  'home.title': 'Ready to go birding?',
  'home.introVoor':
    'Wherever you are: on foot, on a bike, in a hide or in the garden. When you see or hear something, press the button and say it, for example',
  'home.introExample1': '"six Woodpigeons flying over"',
  'home.introOf': 'or',
  'home.introExample2': '"Chaffinch calling"',
  'home.installProblem': 'The app couldn’t sign in ({problem}). Please try again later.',
  'home.staleStopped':
    'Your session from {moment} was still running. After 8 hours without anything said, it stopped by itself.',
  'home.view': 'View',
  'home.toSessions': 'Go to sessions',
  'home.shareTitle': 'Share with the developer?',
  'home.shareText':
    'Fluistervink is still being developed. After each session, may the app send the developer what you said (as text), what the app made of it, your corrections and feedback, and the locations of your observations? Not the recordings, unless you switch that on in Settings. Only the developer can read it; you can switch it off at any time.',
  'home.privacyLink': 'More about privacy',
  'home.shareYes': 'Yes, share',
  'home.shareNo': 'Rather not',
  'home.start': 'Start birding',
  'home.tip':
    'Never tried it? Give it a go in the garden or at the window: one Blackbird is enough.',
  'home.lastSession': 'Last session',

  // Herinnering aan de export
  'reminder.unreviewed': {
    one: '1 session from more than a week ago hasn’t been reviewed yet.',
    other: '{n} sessions from more than a week ago haven’t been reviewed yet.',
  },
  'reminder.ready': {
    one: '1 session has been ready for waarneming.nl for a week',
    other: '{n} sessions have been ready for waarneming.nl for a week',
  },
  'reminder.readyEnd': '{text}.',
  'reminder.readyAndUnreviewed': '{text}; {n} not reviewed yet.',

  // Nog aan het vogelen?
  'stillBirding.title': 'Still birding?',
  'stillBirding.text': 'Nothing has been said since {moment}.',
  'stillBirding.keep': 'Yes, carry on',
  'stillBirding.stop': 'No, stop',

  // Bijwerken
  'update.loading': 'Loading new version…',
  'update.updatedTo': 'Updated to version {version}',
  'update.whatsNew': 'What’s new?',

  // Instellingen
  'settings.title': 'Settings',
  'settings.nameLabel': 'Name (optional)',
  'settings.nameHint':
    'Only for the developer, so they know who usage and feedback come from. Leave it empty and save to remove your name.',
  'settings.nameSaved': 'Saved.',
  'settings.nameRemoved': 'Name removed.',
  'settings.saveFailed': 'Couldn’t save: {error}',
  'settings.version': 'version {version}',
  'settings.androidApp': 'Android app {version}',
  'settings.ownerCode': 'Developer code',
  'settings.codeLabel': 'Code',
  'settings.codeHint':
    'Only for the developer; the app works without a code. Leave it empty and save to remove the code.',
  'settings.saveAndTest': 'Save and test',
  'settings.connectedAs': 'Connected as {tester}.',
  'settings.connected': 'Connected to the proxy.',
  'settings.wrongCode': 'That code isn’t right.',
  'settings.signInFailed': 'Can’t sign in: {error}',
  'settings.proxyUnreachable': 'Can’t reach the proxy.',

  // Keuzes
  'prefs.groupUnderstanding': 'What the app understands',
  'prefs.groupField': 'Controls in the field',
  'prefs.groupCounting': 'Counting',
  'prefs.groupReview': 'Review and export',
  'prefs.soortgroepen': 'Other wildlife too',
  'prefs.soortgroepenHint':
    'Besides birds, also mammals, reptiles and amphibians, butterflies and dragonflies ("two Roe Deer", "a Common Toad", "a Red Admiral"). They go to waarneming.nl; eBird only takes birds. Off: the app only picks birds, which avoids mix-ups with short names.',
  'prefs.volumeknop': 'Volume button to speak',
  'prefs.volumeknopHint':
    'During a session, pressing a volume button (up or down) starts a recording and the next press stops it. Handy with gloves on or binoculars in your other hand; a Bluetooth selfie button works the same way. You can’t change the volume with that button during a session. Only works with the app on screen, not with the screen off.',
  'prefs.gesproken': 'Spoken confirmation in your earbuds (trial)',
  'prefs.gesprokenHint':
    'After the buzz, the app says what it logged ("woodpigeon, 6, flying over"). Only with earbuds or a headset connected, never through the speaker. A podcast goes quieter for a moment.',
  'prefs.zeldzaamOnzeker': 'Mark rare species as uncertain',
  'prefs.zeldzaamOnzekerHint':
    'If the app picks a species that is rare or very rare on waarneming.nl, the observation is marked uncertain, so you see it at the top when you review at home. Usually it’s a mix-up with a common species.',
  'prefs.exportHerinnering': 'Export reminder',
  'prefs.exportHerinneringHint':
    'If sessions have been ready for waarneming.nl for a week, or have been waiting a week to be reviewed, you’ll see a note on the home screen. "Later" hides it for three days.',
  'prefs.ebird': 'I use eBird',
  'prefs.ebirdHint':
    'When you stop, the app asks whether you recorded everything, and a session gets an eBird card with the duration and distance. Under Sessions you export the reviewed sessions in one file, which you upload to eBird yourself. Sessions from before you switched this on only count once you answer the question.',

  // Back-up
  'backup.title': 'Backup',
  'backup.hint':
    'Your sessions are only on this device. A backup saves them as a file, so you can restore them on a new phone or after the app was removed. Put the file somewhere else (Drive, your computer) to be really safe. Recordings are only included for sessions you haven’t reviewed yet.',
  'backup.hintNative':
    'Your sessions are only on this device. A backup saves them as a file in Downloads, so you can restore them on a new phone or after the app was removed. Put the file somewhere else (Drive, your computer) to be really safe. Recordings are only included for sessions you haven’t reviewed yet.',
  'backup.last': 'Last backup: {date}.',
  'backup.since': '{sessions} added since.',
  'backup.noneYetOf': 'No backup of your {sessions} yet.',
  'backup.noneYet': 'No backup yet.',
  'backup.make': 'Make a backup',
  'backup.restore': 'Restore a backup',
  'backup.restoreHint':
    'Restoring only adds sessions that aren’t here yet; anything already here stays as it is. Settings aren’t included.',
  'backup.savedIn': 'Saved in {folder}.',
  'backup.downloaded': 'Backup downloaded.',
  'backup.failed': 'Backup failed: {error}',
  'backup.restoreFailed': 'Restore failed: {error}',

  // Delen
  'share.title': 'Share with the developer',
  'share.hintVoor':
    'After each session, what you said, what the app made of it, your corrections when reviewing and your feedback go to the developer, to improve the recognition. So do the locations of your observations. See',
  'share.hintNa': '.',
  'share.sessions': 'Share sessions and feedback',
  'share.audio': 'Recordings too (helps to compare speech recognition)',
  'share.now': 'Send now',
  'share.sent': '{what} sent.',
  'share.allSent': 'Everything had already been sent.',
  'share.failed': 'Sending failed: {error}',
  'share.lastSent': 'Last sent: {date}.',
  'share.nothingSent': 'Nothing sent yet.',

  // Opnames
  'recordings.title': 'Recordings',
  'recordings.hint':
    'The app keeps what you say on your phone, so you can listen back at home. If you delete the recordings, the sessions, what you said as text and the observations all stay. You can also do it per session, at the bottom of that session.',
  'recordings.onDevice': 'On this device: {recordings}.',
  'recordings.deleteAll': 'Delete all recordings',
  'recordings.none': 'There are no recordings on this device.',
  'recordings.deleted': '{recordings} deleted.',
  'recordings.scopeAll': 'from all sessions',
  'recordings.describe': '{recordings} ({size})',
  'recordings.confirmDelete':
    'Delete {recordings} {scope}? What you said stays as text, and so do the observations. You won’t be able to listen back afterwards.',
  'recordings.sharedAll': {
    one: 'It has already been shared with the developer and stays there. If you want that gone too, ask in your feedback.',
    other:
      'They have already been shared with the developer and stay there. If you want that gone too, ask in your feedback.',
  },
  'recordings.sharedSome': {
    one: '1 of them has already been shared with the developer and stays there. If you want that gone too, ask in your feedback.',
    other:
      '{n} of them have already been shared with the developer and stay there. If you want that gone too, ask in your feedback.',
  },

  // Trektelmodus
  'trektel.label': 'Migration count mode (trial)',
  'trektel.hint1':
    'For when you count from one spot with the phone beside you. During a session you get a "Start migration count" button: the app then keeps listening and processes everything you say, without you having to press each time. Silence isn’t sent.',
  'trektel.hint2':
    'The screen stays on while the count runs, which uses battery. If you switch to another app (such as Merlin) or the screen locks, the count pauses: the microphone goes off (one long buzz) and back on when you return. After a quarter of an hour away the count stops (two long buzzes), and after four hours it stops by itself.',
  'trektel.hint3':
    'The app processes at most 5 hours of speech a day. Beyond that the count stops; anything you say after that is kept, and you can have it processed the next day with "Retry".',
  // Sessiescherm
  'session.gpsAccuracy': 'Location ±{m} m',
  'session.gpsSlow': 'No location yet, you can still speak',
  'session.gpsSearching': 'Finding location…',
  'session.gpsDenied': 'No access to location. Allow it in the browser settings.',
  'session.gpsUnavailable': 'Location isn’t available on this device.',
  'session.micStarting': 'Turning on the microphone…',
  'session.trektelStart': 'Start migration count',
  'session.typePlaceholder': 'Or type: six Woodpigeons flying over',
  'session.typeLabel': 'Type what you saw',
  'session.submit': 'Process',
  'session.talk': 'Speak',
  'session.talkStop': 'Stop · {s} s',
  'session.trektelStop': 'Stop count · {clock}',
  'session.trektelPaused': 'Paused',
  'session.trektelMicStarting': 'Turning on the microphone',
  'session.trektelHearing': 'Hearing speech',
  'session.trektelListening': 'Listening',
  'session.trektelSent': { one: '1 chunk sent', other: '{n} chunks sent' },
  'session.micDenied': 'No access to the microphone. Allow it in the browser settings.',
  'session.micUnsupported': 'This browser can’t record.',
  'session.micFailed': 'The microphone didn’t come on. Tap again.',
  'session.limitAudio': '5 hours have already been spoken today, the daily maximum',
  'session.limitModel':
    'a great many voice notes have already been processed today, the daily maximum',
  'session.trektelStoppedLimit':
    'Migration count stopped: {why}. The chunks are kept; tap Retry tomorrow to have them processed.',
  'session.saveFailedFull':
    'Your phone is full: the last recording couldn’t be saved. Free up some space (delete photos or old recordings, for example) and try again.',
  'session.saveFailed': 'The last recording couldn’t be saved. Please try again.',
  'session.trektelStoppedSave': 'Migration count stopped. {why}',

  // Microfoon
  'mic.headset': 'Listening through your earbuds',
  'mic.phone': 'Listening through the phone, not your earbuds',

  // Lijst met waarnemingen en uitspraken
  'log.waiting': {
    one: 'No signal: 1 voice note is waiting. It will be processed as soon as there’s a connection.',
    other:
      'No signal: {n} voice notes are waiting. They’ll be processed as soon as there’s a connection.',
  },
  'log.waitingLong': {
    one: 'No signal for over 2 hours: 1 voice note is waiting. It will be processed as soon as there’s a connection.',
    other:
      'No signal for over 2 hours: {n} voice notes are waiting. They’ll be processed as soon as there’s a connection.',
  },
  'log.retry': 'Try again',
  'log.queued': {
    one: '1 voice note in the queue (see Voice notes)',
    other: '{n} voice notes in the queue (see Voice notes)',
  },
  'log.trektelBacklog':
    'Your migration count kept going: {n} voice notes from the last {minutes} minutes are in and are now being processed in order.',
  'log.observations': 'Observations',
  'log.speciesCount': { one: '1 species', other: '{n} species' },
  'log.observationCount': { one: '1 observation', other: '{n} observations' },
  'log.onlyUncertain': 'Uncertain only ({n})',
  'log.edit': 'Edit observation',
  'log.reviewed': 'Reviewed',
  'log.uncertain': 'Uncertain',
  'log.uncertainBecause': 'Uncertain: {reason}',
  'log.note': 'Note: {note}',
  'log.showOnMap': 'Show on the map',
  'log.placedByVoice': 'as spoken',
  'log.placedByHand': 'placed by hand',
  'log.noLocation': 'no location',
  'log.positionOld': 'position {m} min old',
  'log.positionLater': 'position {m} min later',
  'log.discard': 'Remove',
  'log.confirm': 'Correct',
  'log.export': 'Export',
  'log.noUncertainLeft': 'No uncertain observations left.',
  'log.empty': 'Nothing logged yet. Press Speak and say what you see or hear.',
  'log.deleted': 'Deleted ({n})',
  'log.deletedBy.hand': 'deleted by hand',
  'log.deletedBy.voice': 'deleted by voice',
  'log.deletedBy.undo': 'deleted by undo',
  'log.restore': 'Restore',
  'log.notUnderstood': 'Not understood ({n})',
  'log.notUnderstoodHint':
    'The app found no observation in these. Listen back: if there was a bird after all, turn it into an observation.',
  'log.rescue': 'Make it an observation',
  'log.dismiss': 'No observation',
  'log.male': 'male',
  'log.female': 'female',
  'log.utterances': 'Voice notes ({n})',
  'log.utterancesFailed': 'Voice notes ({n}) · {failed} failed',
  'log.audioDeleted': '(recording deleted)',
  'log.recordingOf': 'Recording of {duration}',
  'log.seconds': '{s} s',
  'log.inBackground': '{duration} (app in background)',
  'log.again': 'Retry',
  'log.status.feedback': 'feedback',
  'log.status.undone': 'undone',
  'log.status.waiting': 'waiting for signal',
  'log.status.queued': 'queued',
  'log.status.transcribing': 'listening…',
  'log.status.processing': 'working…',
  'log.status.failed': 'failed',
  'log.status.ignored': 'not understood',
  'log.status.uncertain': 'uncertain',
  'log.status.done': 'processed',
  // Vorige sessies
  'sessions.title': 'Past sessions',
  'sessions.cancel': 'Cancel',
  'sessions.cleanUp': 'Tidy up',
  'sessions.none': 'No sessions yet.',
  'sessions.readyForWaarneming': {
    one: '1 session ready for waarneming.nl',
    other: '{n} sessions ready for waarneming.nl',
  },
  'sessions.exportWaarneming': 'Export for waarneming.nl',
  'sessions.importHintVoor': 'Import the file at',
  'sessions.importHintNa':
    ', with the site set to Dutch (NL, top right; that’s the default): behaviour and method are in Dutch in the file.',
  'sessions.forEbird': { one: '1 session for eBird', other: '{n} sessions for eBird' },
  'sessions.ebirdQuestion': 'Did you record everything you could identify?',
  'sessions.yes': 'Yes',
  'sessions.no': 'No',
  'sessions.notToEbird': 'Not for eBird',
  'sessions.exportEbird': 'Export for eBird',
  'sessions.answerFirst': {
    one: 'First answer the question for 1 session.',
    other: 'First answer the question for {n} sessions.',
  },
  'sessions.ebirdHintVoor': 'Import the file at',
  'sessions.ebirdHintNa':
    'and choose "eBird Record Format (Extended)" under Format. Species eBird doesn’t recognise, you pick there yourself.',
  'sessions.selectHint': 'Tick the sessions you want to delete.',
  'sessions.selectAll': 'Tick all',
  'sessions.selectNone': 'Untick all',
  'sessions.selectExported': 'All exported',
  'sessions.selectEmpty': 'All empty ({n})',
  'sessions.nothingSelected': 'Nothing ticked',
  'sessions.deleteSelected': { one: 'Delete 1 session', other: 'Delete {n} sessions' },
  'sessions.confirmDelete': {
    one: 'Permanently delete 1 session, with all its observations and recordings?',
    other: 'Permanently delete {n} sessions, with all their observations and recordings?',
  },
  'sessions.confirmNotExported': {
    one: 'One of them hasn’t been exported yet.',
    other: '{n} of them haven’t been exported yet.',
  },
  'sessions.confirmDevNotes': {
    one: '1 feedback message will be deleted too.',
    other: '{n} feedback messages will be deleted too.',
  },
  'sessions.confirmUnprocessed': {
    one: '1 voice note hasn’t been processed yet (no signal, for example) and will be lost.',
    other: '{n} voice notes haven’t been processed yet (no signal, for example) and will be lost.',
  },
  'sessions.utterances': { one: '1 voice note', other: '{n} voice notes' },
  'sessions.devNotes': { one: '1 feedback message', other: '{n} feedback messages' },
  'sessions.unprocessed': '{n} not processed',
  'sessions.badgeWaarneming': 'waarneming.nl ✓',
  'sessions.badgeExported': 'exported',
  'sessions.badgeReady': 'ready',
  'sessions.badgeNotExported': 'not exported',
  'sessions.badgeEbird': 'eBird ✓',
  'sessions.when': '{day}, {time}',

  // Eén sessie nalopen
  'past.back': 'Sessions',
  'past.confirmResume': 'Resume this session?',
  'past.confirmDelete':
    'Permanently delete this session, with all its observations and recordings?',
  'past.confirmDeleteNotExported':
    'Permanently delete this session, with all its observations and recordings?\n\nThis session hasn’t been exported yet.',
  'recordings.scopeSession': 'from this session',
  'past.renamePrompt':
    'Name of the session (leave empty for automatic, from the area with the most observations):',
  'past.confirmReady': {
    one: '1 uncertain observation left. Is that one right too? Then it becomes certain.',
    other: '{n} uncertain observations left. Are those right too? Then they become certain.',
  },
  'past.ebirdQuestionLabel': 'Question for eBird',
  'past.forEbird': 'For eBird',
  'past.done': 'Done',
  'past.notNow': 'Not now',
  'past.savedTitle': '✓ Session saved',
  'past.savedText':
    'Everything is safely on your phone. Review the observations and mark the session ready for waarneming.nl.',
  'past.rename': 'Rename',
  'past.when': '{date}, {from}–{to}',
  'past.duration': 'Duration',
  'past.species': 'Species',
  // Met een zacht afbreekstreepje voor een heel smalle telefoon
  'past.observations': 'Obser­vations',
  'past.uncertainCount': '{n} uncertain',
  'past.readyTitle': 'Finished reviewing?',
  'past.exportedOn': 'Exported on {date} at {time}.',
  'past.isReady': 'This session is ready. Export all ready sessions in one go under Sessions.',
  'past.toSessions': 'Go to Sessions',
  'past.notReadyYet': 'Not ready after all',
  'past.unprocessed': {
    one: '1 voice note is still waiting to be processed, for example because there was no signal. That happens by itself once there’s a connection; after that you can mark the session ready.',
    other:
      '{n} voice notes are still waiting to be processed, for example because there was no signal. That happens by itself once there’s a connection; after that you can mark the session ready.',
  },
  'past.uncertainLeft': {
    one: '1 uncertain observation left. Go through it at the top, or tap it in the list.',
    other: '{n} uncertain observations left. Go through them at the top, or tap them in the list.',
  },
  'past.allCorrect': 'All correct, ready for waarneming.nl',
  'past.allCorrectEbird': 'All correct, ready to export',
  'past.readyHint':
    'The observations then count as reviewed. You export sessions that are ready later, in one file, under Sessions.',
  'past.readyHintEbird':
    'The observations then count as reviewed. You export sessions that are ready later, in one file for waarneming.nl and one for eBird, under Sessions.',
  'past.exportOnlyThis': 'Export just this session',
  'past.exportOnlyThisEbird': 'Export just this session for waarneming.nl',
  'past.importHintVoor': 'Import the file at',
  'past.importHintNa': ', with the site set to Dutch.',
  'past.resume': 'Stopped by accident? Resume',
  'past.deleteRecordings': 'Delete only the recordings',
  'past.delete': 'Delete session',

  // Onzeker nalopen
  'review.title': 'Review uncertain',
  'review.left': '{n} left',
  'review.skippedCount': '{n} skipped',
  'review.whichSpecies': 'Which species was it?',
  'review.edit': 'Edit',
  'review.skip': 'Skip',
  'review.skipped': {
    one: 'Skipped. Edit it in the list, or confirm it at the bottom with "All correct".',
    other: 'Skipped. Edit them in the list, or confirm them at the bottom with "All correct".',
  },
  'review.again': 'Go through again',

  // Samenvatting
  'summary.title': 'Summary',
  'summary.copy': 'Copy',
  'summary.copied': 'Copied',
  'summary.heading': '{title}, {date}: {n} species',
  // Bewerkformulier
  'editor.species': 'Species',
  'editor.speciesList': 'Species',
  'editor.count': 'Count',
  'editor.chooseSpecies': 'Choose a species from the list.',
  'editor.activity': 'Behaviour',
  'editor.method': 'Method',
  'editor.lifeStage': 'Age/plumage',
  'editor.sex': 'Sex',
  'editor.countingMethod': 'Counting method',
  'editor.more': 'More',
  'editor.location': 'Location',
  'editor.placeByVoice': 'as spoken, ±{m} m',
  'editor.placeByHand': 'placed by hand (±{m} m)',
  'editor.placeGps': 'GPS, ±{m} m',
  'editor.changeLocation': 'Change location',
  'editor.spoken': 'Said: {text}',
  'editor.backToRecorded': 'Back to the recorded spot',
  'editor.backToRecordedNone': 'Back to the recorded spot (no location)',
  'editor.privateNote': 'Private note (not included in the export)',
  'editor.remarks': 'Remarks for waarneming.nl',
  'editor.uncertain': 'Uncertain',
  'editor.uncertainBecause': 'Uncertain ({reason})',
  'editor.copy': 'Copy',
  'editor.delete': 'Delete',
  'editor.gone':
    'This observation has been deleted in the meantime, by voice for example. You can restore it under "Deleted" in the session.',
  'editor.cancel': 'Cancel',

  // Plek kiezen
  'picker.markerTitle': 'Spot of the observation (drag to move)',
  'picker.tilesFailed':
    'The map won’t load. "Current location" still works; you can tap the map later, when you have signal again.',
  'picker.tilesFailedOffline':
    'The map won’t load: no signal. "Current location" still works; you can tap the map later, when you have signal again.',
  'picker.hint': 'Tap the map or drag the dot to where the bird was.',
  'picker.locating': 'Finding your spot…',
  'picker.here': 'Current location',
  'unplaced.question': {
    one: 'Where were you standing? The observation without a location goes there.',
    other: 'Where were you standing? All {n} observations without a location go there.',
  },
  'unplaced.choose': { one: 'Choose a spot', other: 'Choose a spot for all {n}' },

  // Kaart van een sessie
  'map.zoomIn': 'Zoom in',
  'map.uncertain': '(uncertain)',
  'map.uncertainTitle': 'uncertain',
  'map.mapsApp': 'maps app',
  'map.accuracy': '± {m} m · ',
  'map.clusterCount': '{n} observations',
  'map.clusterCountScreenReader': ' observations',
  'map.withoutLocation': {
    one: '1 observation without a location isn’t on the map.',
    other: '{n} observations without a location aren’t on the map.',
  },
  'map.reload': 'Reload map',

  // Soortgroepen
  'group.1': 'Birds',
  'group.2': 'Mammals',
  'group.3': 'Reptiles and amphibians',
  'group.4': 'Butterflies',
  'group.5': 'Dragonflies',

  // Zeldzaamheid
  'rarity.1': 'common',
  'rarity.2': 'fairly common',
  'rarity.3': 'rare',
  'rarity.4': 'very rare',
  // eBird bij een sessie
  'ebird.title': 'eBird',
  'ebird.duration': 'Duration',
  'ebird.minutes': '{n} min',
  'ebird.protocol': 'Protocol',
  'ebird.protocolAutomatic': 'Automatic: {protocol}',
  'ebird.protocol.Stationary': 'Stationary',
  'ebird.protocol.Traveling': 'Traveling',
  'ebird.protocol.Incidental': 'Incidental',
  'ebird.distance': 'Distance in km',
  'ebird.distancePlaceholder': 'e.g. 3.5',
  'ebird.miles': '{miles} miles for eBird.',
  'ebird.measured': 'Measured: {km} km.',
  'ebird.backToMeasured': 'Back to measured',
  'ebird.notMeasured': 'Not measured (session from before 11 November).',
  'ebird.skip': 'This session doesn’t need to go to eBird',
  'ebird.skipHint': 'It then won’t be included in "Export for eBird" on the Sessions screen.',
  'ebird.exportedOn': 'Exported on {date}.',
  'ebird.answerFirst': 'First answer the question above.',
  'ebird.importHintVoor': 'Import the file at',
  'ebird.importHintNa':
    'and choose "eBird Record Format (Extended)" under Format: eBird picks the other format itself, and then the import fails with "Missing location name". Species eBird doesn’t recognise, you pick there yourself.',
  'checklist.complete': 'Did you record everything you could identify?',
  'checklist.completeHint':
    'That doesn’t mean you counted every bird, just that you didn’t deliberately leave out a species.',
  'checklist.observers': 'Number of observers',
  'checklist.fewer': 'One fewer',
  'checklist.more': 'One more',

  // Na een export
  'export.continue': 'Export anyway?',
  'export.saveFailed': 'Couldn’t save: {error}',
  'export.savedIn': 'The file is in {folder}.',
  'export.excluded': '{n} unticked and not exported.',
  'export.noneWithLocation': 'No observations with a location to export.',
  'export.uncertain': {
    one: '1 observation is still uncertain and goes in as "not certain".',
    other: '{n} observations are still uncertain and go in as "not certain".',
  },
  'export.earlierThis':
    'This session has been exported before. Waarneming.nl rejects the whole import if it contains an observation that has already been entered.',
  'export.earlierSome':
    '{n} of these sessions have been exported before. Waarneming.nl rejects the whole import if it contains an observation that has already been entered.',
  'export.done': {
    one: '1 observation exported.',
    other: '{n} observations exported.',
  },
  'export.doneFromSessions': {
    one: '1 observation from {sessions} sessions exported.',
    other: '{n} observations from {sessions} sessions exported.',
  },
  'export.skippedNoLocation': '{n} without a location skipped; enter those by hand.',
  'ebirdExport.sessionPrefix': '{name}: ',
  'ebirdExport.defaultSessionName': 'Session',
  'ebirdExport.needComplete': '{prefix}first say whether you recorded everything.',
  'ebirdExport.needDistance': '{prefix}a traveling count needs a distance.',
  'ebirdExport.long':
    '{prefix}longer than 8 km. eBird recommends shorter traveling counts; you can still split it on eBird.',
  'ebirdExport.midnight': '{prefix}runs past midnight and becomes one checklist on the start date.',
  'ebirdExport.uncertain': {
    one: '1 observation is still uncertain. eBird has no "not certain": it goes in as a normal record.',
    other:
      '{n} observations are still uncertain. eBird has no "not certain": they go in as normal records.',
  },
  'ebirdExport.notReady': 'Not ready for eBird yet:',
  'ebirdExport.none': 'No observations to export.',
  'ebirdExport.earlierThis':
    'This session has been exported for eBird before. Don’t import it twice.',
  'ebirdExport.earlierSome':
    '{n} of these sessions have been exported for eBird before. Don’t import them twice.',
  'ebirdExport.done': {
    one: '1 species exported for eBird.',
    other: '{n} species exported for eBird.',
  },
  'ebirdExport.notBirds': {
    one: '1 observation of other wildlife left out: eBird is for birds only.',
    other: '{n} observations of other wildlife left out: eBird is for birds only.',
  },

  // Back-up terugzetten
  'import.none': 'No new sessions found.',
  'import.added': {
    one: '1 session restored, under Past sessions.',
    other: '{n} sessions restored, under Past sessions.',
  },
  'import.skipped': { one: '1 was already here.', other: '{n} were already here.' },
  'import.feedback': '{n}× separate feedback restored.',
  'import.notOurs': 'This isn’t a Fluistervink export.',
  'import.invalid': 'Invalid export: {what}',
  // Feedback
  'notes.title': 'Feedback',
  'notes.copy': 'Copy as Markdown',
  'notes.copied': 'Copied ✓',
  'notes.introVoor': 'What struck you about the app? Type it below.',
  'notes.introSharing':
    'Feedback goes straight to the developer, or after you stop during a session.',
  'notes.introNotSharingVoor': 'Feedback goes to the developer if you switch on sharing (',
  'notes.introNotSharingNa': ').',
  'notes.introNa': 'Sent feedback stays here; you can always remove it.',
  'notes.placeholder': 'What struck you? For example: it didn’t recognise Bar-tailed Godwit',
  'notes.label': 'New feedback',
  'notes.add': 'Add',
  'notes.location': 'location',
  'notes.sent': 'sent ✓',
  'notes.afterSession': 'sent after the session',
  'notes.notSent': 'not sent yet',
  'notes.none': 'No feedback yet.',
  'notes.allSent': 'All feedback has been sent.',
  'notes.earlier': 'Sent earlier ({n})',
  'notes.confirmDelete': 'Remove this feedback?\n\n"{text}"',

  // Fouten bij verbinding en aanmelden
  'error.proxyUnreachable': 'Can’t reach the proxy',
  'error.offline': 'No internet connection',
  'error.captivePortal': 'No answer from the proxy (a wifi login page?)',
  'error.noCodeSignIn': 'Signing in without a code is switched off; enter a code',
  'error.turnstileLoad': 'Couldn’t load the Cloudflare check',
  'error.turnstileSlow': 'The Cloudflare check took too long',
  'error.turnstileFailed': 'The Cloudflare check failed ({code})',
  'error.transcribePrefix': 'Speech recognition: {message}',

  // Locatie
  'location.unsupported': 'This phone or browser doesn’t give a location.',
  'location.denied':
    'The app isn’t allowed to use your location. Switch it on in your phone’s settings.',
  'location.notFound': 'Couldn’t find where you are. Try again outside, or tap the map.',
  'location.notFoundOffline':
    'Couldn’t find where you are: without signal the GPS sometimes takes minutes. Tap the map, or try again later.',

  // Afspelen
  'player.pause': 'Pause recording',
  'player.play': 'Play recording',

  // Trektelling
  'trektel.leave': 'The migration count stops on another screen. Leave anyway?',
  'trektel.micNotBack':
    'Migration count stopped: the microphone wouldn’t come back on. Start the count again; what you already said has been kept.',
  'trektel.micLost':
    'Migration count stopped: the microphone dropped out. Start the count again; what you already said has been kept.',
  'trektel.micFailed': 'The microphone won’t come on.',

  // Waarom de app een waarneming onzeker maakt
  'reason.rare': 'Rare species ({species}): is that right?',
  'reason.accidental': 'Recorded by accident? {s} s recording, heard: "{transcript}"',
  'reason.notUnderstood': 'Not understood, heard: "{transcript}". Choose the species',
  'reason.belowOne': '{base} − {minus} isn’t possible: set to 1',
  'reason.onlyNumber':
    'Only heard "{transcript}"; perhaps "a …" (new observation). Was {count} × {species}',
  'reason.vagrant': 'Vagrant, not in the standard list (said: "{named}")',
  'reason.place': 'Spot mentioned: "{text}"; put it on the map',

  // Gesproken bevestiging
  'spoken.failed': 'Didn’t work',
  'spoken.ignored': 'Not understood',
  'spoken.note': 'Feedback saved',
  'spoken.undone': 'Undone',
  'spoken.saved': 'Saved',
  'spoken.savedUncertain': 'Saved, uncertain',
  'spoken.deleted': 'removed: {species}',
  'spoken.updated': 'changed: {what}',
  'spoken.replaced': '{before} is now {after}',
  'spoken.changed': '{species}, {before} is now {after}',
  'spoken.many': '{n} observations',
  'spoken.manyFlagged': '{n} observations. Uncertain',
  'spoken.manyUncertain': '{n} observations, {uncertain} uncertain',
  'spoken.flagged': '{sentence}. Uncertain',
  'spoken.uncertain': 'uncertain',
  'spoken.or': ' or ',
  'spoken.meters': '{m} metres',
  'spoken.kilometers': '{km} kilometres',
  'spoken.direction.N': 'north',
  'spoken.direction.NO': 'north-east',
  'spoken.direction.O': 'east',
  'spoken.direction.ZO': 'south-east',
  'spoken.direction.Z': 'south',
  'spoken.direction.ZW': 'south-west',
  'spoken.direction.W': 'west',
  'spoken.direction.NW': 'north-west',
  'spoken.caughtUp': { one: 'one voice note processed', other: '{n} voice notes processed' },
  'spoken.caughtUpFailed': '{n} failed',

  // Zeemeeuwen
  'gulls.label': 'There’s no such thing as a seagull',
};
