import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PEGBOARD,
  findPegboardPreset,
  PEGBOARD_PRESETS
} from './pegboard.model';

describe('Pegboard model', () => {
  it('uses a 24 by 18 Pegboard by default', () => {
    expect(DEFAULT_PEGBOARD.width).toBe(24);
    expect(DEFAULT_PEGBOARD.height).toBe(18);
  });

  it('offers small, medium, and large Pegboard presets', () => {
    expect(PEGBOARD_PRESETS[0]).toEqual(DEFAULT_PEGBOARD);
    expect(
      PEGBOARD_PRESETS.map(({ width, height }) => [width, height])
    ).toEqual([
      [24, 18],
      [48, 36],
      [84, 63]
    ]);
  });

  it('matches presets only when both dimensions are exact', () => {
    expect(findPegboardPreset(24, 18)?.labelKey).toBe('new.preset.small');
    expect(findPegboardPreset(48, 36)?.labelKey).toBe('new.preset.medium');
    expect(findPegboardPreset(84, 63)?.labelKey).toBe('new.preset.large');
    expect(findPegboardPreset(24, 36)).toBeUndefined();
  });
});
