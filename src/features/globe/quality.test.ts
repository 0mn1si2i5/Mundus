import { describe, expect, it } from 'vitest';
import { chooseQualityProfile } from './quality';

describe('render quality', () => {
  it('uses a bounded low profile on mobile', () => {
    const profile = chooseQualityProfile({
      viewportWidth: 390,
      devicePixelRatio: 3,
      hardwareConcurrency: 6,
    });
    expect(profile.level).toBe('low');
    expect(profile.dpr[1]).toBe(1.25);
    expect(profile.textureWidth).toBe(1024);
  });

  it('selects the detailed profile only for capable desktops', () => {
    const profile = chooseQualityProfile({
      viewportWidth: 1440,
      devicePixelRatio: 2,
      hardwareConcurrency: 10,
    });
    expect(profile.level).toBe('high');
    expect(profile.textureWidth).toBe(2048);
  });

  it('uses the detailed texture on medium desktops', () => {
    const profile = chooseQualityProfile({
      viewportWidth: 1024,
      devicePixelRatio: 1,
      hardwareConcurrency: 6,
    });
    expect(profile.level).toBe('medium');
    expect(profile.textureWidth).toBe(2048);
  });
});
