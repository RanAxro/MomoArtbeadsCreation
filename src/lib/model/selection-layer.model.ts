import { z } from 'zod';
import { paletteSchema } from './palette.model';

export const selectionLayerSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  cells: z.array(z.number().int().nonnegative()),
  palette: paletteSchema,
  selectionCells: z.array(z.number().int().nonnegative()),
  sourceSelectionCells: z
    .array(z.number().int().nonnegative())
    .optional(),
  x: z.number().int(),
  y: z.number().int()
});

export type SelectionLayer = z.infer<typeof selectionLayerSchema>;
