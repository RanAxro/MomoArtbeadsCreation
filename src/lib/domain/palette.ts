import { rgbToOklab, hexToRgb, oklabDistance, type LabColor } from './color';
import { ARTBEAD_COLORS } from '$lib/config/pegboard';

export interface BeadColor {
  id: string;
  name: string;
  hex: string;
  code: string;
  stock?: number;
}

export interface BeadPalette {
  id: string;
  name: string;
  colors: BeadColor[];
}

export function createStarterPalette(id = crypto.randomUUID()): BeadPalette {
  return {
    id,
    name: 'Artbead Palette',
    colors: ARTBEAD_COLORS.map((hex, index) => {
      const code = String(index + 1).padStart(2, '0');
      return {
        id: `${id}-${index + 1}`,
        name: `A${code}`,
        hex,
        code
      };
    })
  };
}

export function createEmptyBeadColor(paletteId: string, index: number): BeadColor {
  return {
    id: `${paletteId}-custom-${crypto.randomUUID()}`,
    name: `自定义色 ${index}`,
    hex: '#FFFFFF',
    code: String(index).padStart(2, '0')
  };
}

export interface IndexedColor {
  hex: string;
  lab: LabColor;
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
