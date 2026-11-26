import { describe, expect, it } from 'vitest';
import { hexToRgb, rgbToHex } from './color';
import {
  clonePalette,
  createColorIndex,
  createStarterPalette,
  nearestPaletteIndex
} from './palette';

describe('palette domain', () => {
  it('converts hex colors to rgb and back', () => {
    expect(rgbToHex(hexToRgb('#12aBcD'))).toBe('#12ABCD');
  });

  it('matches an rgb color to the closest palette color', () => {
    const palette = createStarterPalette();
    const index = createColorIndex(palette);

    expect(nearestPaletteIndex(index, { r: 249, g: 238, b: 223 })).toBe(6);
  });

  it('clones reactive palette proxies into storage-safe plain data', () => {
    const palette = createStarterPalette();
    const reactivePalette = new Proxy(
      {
        ...palette,
        colors: new Proxy(
          palette.colors.map((color) => new Proxy(color, {})),
          {}
        )
      },
      {}
    );

    expect(() => structuredClone(reactivePalette)).toThrow();
    expect(() => structuredClone(clonePalette(reactivePalette))).not.toThrow();
  });
});
