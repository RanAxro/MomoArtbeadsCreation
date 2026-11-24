import { describe, expect, it } from 'vitest';
import { ARTBEAD_COLORS, DEFAULT_PEGBOARD, PEGBOARD_PRESETS } from './pegboard';

describe('Pegboard configuration', () => {
  it('uses a 24 by 18 Pegboard by default', () => {
    expect(DEFAULT_PEGBOARD.width).toBe(24);
    expect(DEFAULT_PEGBOARD.height).toBe(18);
    expect(PEGBOARD_PRESETS).toHaveLength(1);
    expect(PEGBOARD_PRESETS[0]).toEqual(DEFAULT_PEGBOARD);
  });

  it('stores every available Artbead color as hexadecimal', () => {
    expect(ARTBEAD_COLORS.length).toBeGreaterThan(0);
    expect(ARTBEAD_COLORS.every((color) => /^#[0-9a-f]{6}$/i.test(color))).toBe(true);
  });
});
