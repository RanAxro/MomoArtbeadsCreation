import { rgbToOklab, hexToRgb, oklabDistance } from './color';
import { ARTBEAD_COLOR_FAMILIES } from '$model/artbead-palette.model';
import {
  DEFAULT_CUSTOM_COLOR_HEX,
  DEFAULT_CUSTOM_COLOR_NAME_PREFIX,
  DEFAULT_PALETTE_NAME,
  PALETTE_CODE_PAD_LENGTH,
  type BeadColor,
  type BeadPalette,
  type IndexedColor
} from '$model/palette.model';

export type { BeadColor, BeadPalette, IndexedColor } from '$model/palette.model';

export interface ArtbeadCatalogColor extends BeadColor {
  familyCode: string;
  familyLabelKey: string;
  paletteNumber: number;
  cellNumber: number;
}

export function createArtbeadCode(
  familyCode: string,
  paletteNumber: number,
  cellNumber: number
): string {
  return `${familyCode}${paletteNumber}${cellNumber}`;
}

export const ARTBEAD_CATALOG: readonly ArtbeadCatalogColor[] =
  ARTBEAD_COLOR_FAMILIES.flatMap((family) =>
    family.palettes.flatMap((palette, paletteIndex) =>
      palette.map((hex, cellIndex) => {
        const paletteNumber = paletteIndex + 1;
        const cellNumber = cellIndex + 1;
        const code = createArtbeadCode(family.code, paletteNumber, cellNumber);
        return {
          id: code,
          name: code,
          hex,
          code,
          familyCode: family.code,
          familyLabelKey: family.labelKey,
          paletteNumber,
          cellNumber
        };
      })
    )
  );

export function createStarterPalette(id = crypto.randomUUID()): BeadPalette {
  return {
    id,
    name: DEFAULT_PALETTE_NAME,
    colors: ARTBEAD_CATALOG.map(({ code, hex }, index) => {
      return {
        id: `${id}-${index + 1}`,
        name: code,
        hex,
        code
      };
    })
  };
}

export function clonePalette(palette: BeadPalette): BeadPalette {
  return {
    ...palette,
    colors: palette.colors.map((color) => ({ ...color }))
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
