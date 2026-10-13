import { describe, expect, it } from 'vitest';
import { pickMicrophone } from './microphone';

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
