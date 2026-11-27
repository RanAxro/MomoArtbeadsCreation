import { z } from 'zod';

export enum PaletteSourceType {
  Complete = 'complete',
  Custom = 'custom'
}

export const completePaletteSourceSchema = z.object({
  type: z.literal(PaletteSourceType.Complete)
});

export const customPaletteSourceSchema = z.object({
  type: z.literal(PaletteSourceType.Custom),
  paletteId: z.string().min(1)
});

export const paletteSourceSchema = z.discriminatedUnion('type', [
  completePaletteSourceSchema,
  customPaletteSourceSchema
]);

export type ProjectPaletteSource = z.infer<typeof paletteSourceSchema>;

export const DEFAULT_PROJECT_PALETTE_SOURCE: ProjectPaletteSource = {
  type: PaletteSourceType.Complete
};

export function isCompletePaletteSource(
  source: ProjectPaletteSource
): source is z.infer<typeof completePaletteSourceSchema> {
  return source.type === PaletteSourceType.Complete;
}

export function isCustomPaletteSource(
  source: ProjectPaletteSource
): source is z.infer<typeof customPaletteSourceSchema> {
  return source.type === PaletteSourceType.Custom;
}
