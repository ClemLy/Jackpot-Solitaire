import { afterEach, describe, expect, it, vi } from 'vitest';
import { SOUND_NAMES, playSound, setSoundEnabled, unlockAudio } from './sfx';

describe('sons', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setSoundEnabled(true);
  });

  it('a un son dedie pour gagner, perdre et perdre le magot', () => {
    expect(SOUND_NAMES).toEqual(
      expect.arrayContaining(['win', 'lose', 'bust']),
    );
    expect(new Set(SOUND_NAMES).size).toBe(SOUND_NAMES.length);
  });

  it('reste silencieux sans Web Audio, sans planter', () => {
    vi.stubGlobal('AudioContext', undefined);
    for (const name of SOUND_NAMES) {
      expect(() => playSound(name)).not.toThrow();
    }
    expect(() => unlockAudio()).not.toThrow();
  });

  it('ne casse jamais un coup si le navigateur refuse l audio', () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new DOMException('refuse', 'NotAllowedError');
        }
      },
    );
    expect(() => playSound('foundation')).not.toThrow();
    expect(() => playSound('win')).not.toThrow();
  });
});
