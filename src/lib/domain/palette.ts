import { rgbToOklab, hexToRgb, oklabDistance } from './color';
import { ARTBEAD_COLORS } from '$model/pegboard.model';
import {
  DEFAULT_CUSTOM_COLOR_HEX,
  DEFAULT_CUSTOM_COLOR_NAME_PREFIX,
  DEFAULT_PALETTE_COLOR_PREFIX,
  DEFAULT_PALETTE_NAME,
  PALETTE_CODE_PAD_LENGTH,
  type BeadColor,
  type BeadPalette,
  type IndexedColor
} from '$model/palette.model';

export type { BeadColor, BeadPalette, IndexedColor } from '$model/palette.model';

export function createStarterPalette(id = crypto.randomUUID()): BeadPalette {
  return {
    id,
    name: DEFAULT_PALETTE_NAME,
    colors: ARTBEAD_COLORS.map((hex, index) => {
      const code = String(index + 1).padStart(
        PALETTE_CODE_PAD_LENGTH,
        '0'
      );
      return {
        id: `${id}-${index + 1}`,
        name: `${DEFAULT_PALETTE_COLOR_PREFIX}${code}`,
        hex,
        code
      };
    })
  };
}

export function createEmptyBeadColor(paletteId: string, index: number): BeadColor {
  return {
    id: `${paletteId}-custom-${crypto.randomUUID()}`,
    name: `${DEFAULT_CUSTOM_COLOR_NAME_PREFIX}${index}`,
    hex: DEFAULT_CUSTOM_COLOR_HEX,
    code: String(index).padStart(PALETTE_CODE_PAD_LENGTH, '0')
  };
}

export function createColorIndex(palette: BeadPalette): IndexedColor[] {
  return palette.colors.map((color) => ({
    hex: color.hex,
    lab: rgbToOklab(hexToRgb(color.hex))
  }));
}

export function nearestPaletteIndex(index: IndexedColor[], rgb: { r: number; g: number; b: number }): number {
  const target = rgbToOklab(rgb);
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let indexPosition = 0; indexPosition < index.length; indexPosition += 1) {
    const distance = oklabDistance(target, index[indexPosition].lab);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = indexPosition;
    }
  }

  return nearestIndex + 1;
}
