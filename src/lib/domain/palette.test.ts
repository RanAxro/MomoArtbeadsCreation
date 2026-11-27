import { describe, expect, it } from 'vitest';
import { hexToRgb, rgbToHex } from './color';
import {
  ARTBEAD_CATALOG,
  artbeadCodeForHex,
  clonePalette,
  createArtbeadCode,
  createColorIndex,
  createStarterPalette,
  nearestPaletteIndex
} from './palette';
import { ARTBEAD_COLOR_COUNT } from '$model/artbead-palette.model';

describe('palette domain', () => {
  it('converts hex colors to rgb and back', () => {
    expect(rgbToHex(hexToRgb('#12aBcD'))).toBe('#12ABCD');
  });

  it('matches an rgb color to the closest palette color', () => {
    const palette = createStarterPalette();
    const index = createColorIndex(palette);

    expect(nearestPaletteIndex(index, { r: 202, g: 150, b: 107 })).toBe(
      ARTBEAD_CATALOG.findIndex((color) => color.code === 'A11') + 1
    );
  });

  it('names catalog cells by family, palette, and cell number', () => {
    expect(createArtbeadCode('A', 2, 8)).toBe('A28');
    expect(ARTBEAD_CATALOG).toHaveLength(ARTBEAD_COLOR_COUNT);
    expect(ARTBEAD_CATALOG.slice(0, 7).map((color) => color.code)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7'
    ]);
    const starter = createStarterPalette();
    expect(starter.colors).toHaveLength(ARTBEAD_COLOR_COUNT);
    expect(artbeadCodeForHex('#CA966B')).toBe('A11');
    expect(
      starter.colors.find((color) => color.hex === '#CA966B')
    ).toBeDefined();
    expect(starter.colors[0]).not.toHaveProperty('code');
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
