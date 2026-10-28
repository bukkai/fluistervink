// De uitnodigingsmail voor een tester (scherm Developer). Android-testers
// krijgen de app uit Google Play en vullen de code daar zelf in; de link met
// de code zou op Android in Chrome openen, en de app heeft eigen opslag, los
// van Chrome. Op een iPhone blijft het de link in Safari.

/**
 * Link voor deelname aan de test in Google Play (Play Console → Testen →
 * Interne tests of Gesloten tests → Testers → "Link voor deelname"). De beta
 * hoort bij de interne test, de stabiele versie bij de gesloten test. Leeg:
 * de mail noemt Play niet en stuurt Android-testers naar Chrome, zoals vroeger.
 */
export const PLAY_TEST_LINKS: Record<'beta' | 'stable', string> = {
  beta: '',
  stable: '',
};

export interface InviteMail {
  subject: string;
  body: string;
}

/** Tekst van de uitnodiging; `playLink` leeg betekent: geen app in Play */
export function inviteMail(name: string, link: string, code: string, playLink: string): InviteMail {
  const greeting = name.charAt(0).toUpperCase() + name.slice(1);
  const intro = [
    `Hoi ${greeting},`,
    '',
    'Wil je Fluistervink testen? Met deze app spreek je tijdens het vogelen je waarnemingen in, en thuis loop je ze na en zet je ze op waarneming.nl.',
    '',
  ];
  const outro = [
    '',
    'In de app staat onder "Hoe werkt het?" hoe je waarnemingen inspreekt.',
    '',
    'Groet,',
  ];
  if (!playLink) {
    return {
      subject: 'Uitnodiging: Fluistervink testen',
      body: [
        ...intro,
        'Open deze link op je telefoon, op Android in Chrome en op een iPhone in Safari:',
        link,
        '',
        'De link is persoonlijk, dus stuur hem niet door. Daarna kun je de app op je beginscherm zetten: in Chrome via het menu, "Toevoegen aan startscherm", in Safari via de deelknop, "Zet op beginscherm". Op een iPhone trilt de app niet; kijk dan even op het scherm of je waarneming erbij staat.',
        ...outro,
      ].join('\n'),
    };
  }
  return {
    subject: 'Uitnodiging: Fluistervink testen',
    body: [
      ...intro,
      'Met Android:',
      '1. Open op je telefoon deze link en kies "Tester worden". Gebruik daarbij het Google-account waarvan ik het adres heb; lukt het niet, laat het me dan weten.',
      playLink,
      '2. Installeer daarna Fluistervink uit de Play Store; op die pagina staat een link ernaartoe.',
      '3. Open de app, ga in het menu naar Instellingen en vul daar je toegangscode in (kopiëren en plakken gaat het makkelijkst):',
      code,
      '',
      'Met een iPhone: open deze link in Safari, en zet de app daarna op je beginscherm via de deelknop, "Zet op beginscherm". Op een iPhone trilt de app niet; kijk dan even op het scherm of je waarneming erbij staat.',
      link,
      '',
      'De code en de link zijn persoonlijk, dus stuur ze niet door.',
      ...outro,
    ].join('\n'),
  };
}

/** mailto:-link die de mail-app opent met de uitnodiging */
export function inviteMailto(to: string, mail: InviteMail): string {
  const params = new URLSearchParams({ subject: mail.subject, body: mail.body });
  // URLSearchParams maakt van spaties een +, wat mail-apps letterlijk tonen
  return `mailto:${encodeURIComponent(to)}?${params.toString().replace(/\+/g, '%20')}`;
}
