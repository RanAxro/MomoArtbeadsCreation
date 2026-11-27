import { describe, expect, it } from 'vitest';
import {
  ARTBEAD_COLOR_COUNT,
  ARTBEAD_COLOR_FAMILIES,
  ARTBEAD_FAMILY_COLOR_COUNT,
  GLOBAL_ARTBEAD_COLORS,
  ARTBEAD_MAX_COLORS_PER_PALETTE
} from './artbead-palette.model';

describe('Artbead palette model', () => {
  it('contains seven global colors followed by the complete A-G catalog', () => {
    expect(GLOBAL_ARTBEAD_COLORS.map((color) => color.number)).toEqual([
      1, 2, 3, 4, 5, 6, 7
    ]);
    expect(ARTBEAD_COLOR_FAMILIES.map((family) => family.code)).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
      'G'
    ]);
    expect(ARTBEAD_FAMILY_COLOR_COUNT).toBe(142);
    expect(ARTBEAD_COLOR_COUNT).toBe(149);
  });

  it('keeps every palette within the eight-cell limit', () => {
    expect(
      ARTBEAD_COLOR_FAMILIES.flatMap((family) =>
        family.palettes.map((palette) => palette.length)
      )
    ).toEqual([8, 8, 6, 8, 8, 6, 8, 8, 8, 8, 8, 8, 8, 6, 8, 6, 8, 8, 6]);
    expect(
      ARTBEAD_COLOR_FAMILIES.every((family) =>
        family.palettes.every(
          (palette) =>
            palette.length > 0 &&
            palette.length <= ARTBEAD_MAX_COLORS_PER_PALETTE
        )
      )
    ).toBe(true);
  });

  it('stores every color as an uppercase six-digit hex value', () => {
    expect(
      ARTBEAD_COLOR_FAMILIES.every((family) =>
        family.palettes.every((palette) =>
          palette.every((hex) => /^#[0-9A-F]{6}$/.test(hex))
        )
      )
    ).toBe(true);
  });
});
