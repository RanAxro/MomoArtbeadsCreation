import { z } from 'zod';
import { ARTBEAD_COLOR_COUNT } from './artbead-palette.model';

export const CUSTOM_PALETTE_SCHEMA_VERSION = 1;
export const MAX_CUSTOM_PALETTE_NAME_LENGTH = 80;
export const DEFAULT_CUSTOM_PALETTE_NAME = '未命名调色板';

const customPaletteColorCodesSchema = z
  .array(z.string().min(1))
  .max(ARTBEAD_COLOR_COUNT)
  .refine(
    (codes) => new Set(codes).size === codes.length,
    'Custom palette colors must be unique.'
  );

export const customPaletteSchemeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(MAX_CUSTOM_PALETTE_NAME_LENGTH),
  colorCodes: customPaletteColorCodesSchema,
  schemaVersion: z.literal(CUSTOM_PALETTE_SCHEMA_VERSION),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type CustomPaletteScheme = z.infer<typeof customPaletteSchemeSchema>;
