import { describe, expect, it } from 'vitest';
import { headsetInList, micKind, pickMicrophone } from './microphone';

const device = (deviceId: string, label: string, kind = 'audioinput') =>
  ({ deviceId, label, kind, groupId: '' }) as MediaDeviceInfo;

describe('pickMicrophone', () => {
  it('kiest de microfoon van de telefoon, niet die van Bluetooth', () => {
    const devices = [
      device('default', 'Default'),
      device('bt', 'Bluetooth headset'),
      device('phone', 'Speakerphone'),
      device('out', 'Speaker', 'audiooutput'),
    ];
    expect(pickMicrophone(devices)).toBe('phone');
  });

  it('laat het aan de browser zonder namen (nog geen toestemming)', () => {
    expect(pickMicrophone([device('a', ''), device('b', '')])).toBeUndefined();
  });

  it('laat het aan de browser als er alleen een headset is', () => {
    expect(pickMicrophone([device('default', 'Default'), device('h', 'Headset earpiece')])).toBe(
      undefined,
    );
  });
});

describe('microfoon van de oortjes (proef)', () => {
  const devices = [
    device('default', 'Default'),
    device('ear', 'Headset earpiece'),
    device('phone', 'Speakerphone'),
    device('bt', 'Bluetooth headset'),
  ];

  it('kiest de oortjes als dat gevraagd is', () => {
    expect(pickMicrophone(devices, true)).toBe('bt');
  });

  it('valt terug op de telefoon zonder oortjes', () => {
    expect(pickMicrophone(devices.slice(0, 3), true)).toBe('phone');
  });

  it('ziet het oorstukje van de telefoon niet als oortjes', () => {
    expect(micKind('Headset earpiece')).toBe('telefoon');
    expect(micKind('Speakerphone')).toBe('telefoon');
    expect(micKind('iPhone-microfoon')).toBe('telefoon');
    expect(micKind('Bluetooth headset')).toBe('oortjes');
    expect(micKind('Wired headset')).toBe('oortjes');
    expect(micKind('Default - WH-1000XM5 (Bluetooth)')).toBe('oortjes');
    expect(micKind('')).toBeUndefined();
  });

  it('weet of er oortjes in de lijst staan', () => {
    expect(headsetInList(devices)).toBe(true);
    expect(headsetInList(devices.slice(0, 3))).toBe(false);
  });
});
