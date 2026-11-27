import { z } from 'zod';
import { ARTBEAD_COLOR_COUNT } from './artbead-palette.model';
import { HEX_COLOR_VALUE_PATTERN } from './color.model';

export const CUSTOM_PALETTE_SCHEMA_VERSION = 2;
export const MAX_CUSTOM_PALETTE_NAME_LENGTH = 80;
export const DEFAULT_CUSTOM_PALETTE_NAME = '未命名调色板';

const customPaletteColorHexesSchema = z
  .array(z.string().regex(HEX_COLOR_VALUE_PATTERN))
  .max(ARTBEAD_COLOR_COUNT)
  .refine(
    (hexes) =>
      new Set(hexes.map((hex) => hex.toUpperCase())).size === hexes.length,
    'Custom palette colors must be unique.'
  );

export const customPaletteSchemeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(MAX_CUSTOM_PALETTE_NAME_LENGTH),
  colorHexes: customPaletteColorHexesSchema,
  schemaVersion: z.literal(CUSTOM_PALETTE_SCHEMA_VERSION),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type CustomPaletteScheme = z.infer<typeof customPaletteSchemeSchema>;
