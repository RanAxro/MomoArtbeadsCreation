import { z } from 'zod';
import {
  HEX_COLOR_VALUE_PATTERN,
  WHITE_HEX,
  type LabColor
} from './color.model';

export const PALETTE_MAX_COLORS = 256;

const beadColorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  hex: z.string().regex(HEX_COLOR_VALUE_PATTERN),
  code: z.string(),
  stock: z.number().int().nonnegative().optional()
});

export const paletteSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  colors: z.array(beadColorSchema).min(1).max(PALETTE_MAX_COLORS)
});

export type BeadColor = z.infer<typeof beadColorSchema>;
export type BeadPalette = z.infer<typeof paletteSchema>;

export interface IndexedColor {
  hex: string;
  lab: LabColor;
}

export const DEFAULT_PALETTE_NAME = 'Artbead Palette';
export const DEFAULT_PALETTE_COLOR_PREFIX = 'A';
export const DEFAULT_CUSTOM_COLOR_NAME_PREFIX = '自定义色 ';
export const DEFAULT_CUSTOM_COLOR_HEX = WHITE_HEX;
export const PALETTE_CODE_PAD_LENGTH = 2;
export const DEFAULT_SELECTED_PALETTE_INDEX = 1;
