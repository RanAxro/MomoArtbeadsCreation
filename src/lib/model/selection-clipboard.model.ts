import { z } from 'zod';
import { paletteSchema } from './palette.model';
import type { SelectionBounds } from './selection.model';

export const SELECTION_CLIPBOARD_VERSION = 1;

export const clipboardBoardSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  cells: z.array(z.number().int().nonnegative()),
  palette: paletteSchema
});

export type ClipboardBoardData = z.infer<typeof clipboardBoardSchema>;

const selectionBoundsSchema = z.object({
  minX: z.number().int().nonnegative(),
  minY: z.number().int().nonnegative(),
  maxX: z.number().int().nonnegative(),
  maxY: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive()
});

export const selectionClipboardSchema = z
  .object({
    id: z.string().min(1),
    version: z.literal(SELECTION_CLIPBOARD_VERSION),
    copiedAt: z.string().datetime(),
    lastUsedAt: z.string().datetime().optional(),
    sourceProjectId: z.string().min(1),
    sourceBounds: selectionBoundsSchema,
    board: clipboardBoardSchema,
    selectionCells: z.array(z.number().int().nonnegative()).min(1)
  })
  .superRefine((clipboard, context) => {
    if (
      clipboard.board.cells.length !==
      clipboard.board.width * clipboard.board.height
    ) {
      context.addIssue({
        code: 'custom',
        path: ['board', 'cells'],
        message: 'Clipboard cell count does not match its dimensions.'
      });
    }
    if (
      clipboard.selectionCells.some(
        (index) => index >= clipboard.board.cells.length
      )
    ) {
      context.addIssue({
        code: 'custom',
        path: ['selectionCells'],
        message: 'Clipboard selection contains an out-of-range index.'
      });
    }
    const bounds = clipboard.sourceBounds;
    if (
      bounds.maxX - bounds.minX + 1 !== bounds.width ||
      bounds.maxY - bounds.minY + 1 !== bounds.height
    ) {
      context.addIssue({
        code: 'custom',
        path: ['sourceBounds'],
        message: 'Clipboard source bounds are inconsistent.'
      });
    }
  });

export interface SelectionClipboard {
  id: string;
  version: number;
  copiedAt: string;
  lastUsedAt?: string;
  sourceProjectId: string;
  sourceBounds: SelectionBounds;
  board: ClipboardBoardData;
  selectionCells: number[];
}

export const DEFAULT_CLIPBOARD_HISTORY_LIMIT = 5;
export const MIN_CLIPBOARD_HISTORY_LIMIT = 1;
export const MAX_CLIPBOARD_HISTORY_LIMIT = 50;
export const CLIPBOARD_HISTORY_LIMIT_STORAGE_KEY =
  'momo-artbeads.clipboard-history-limit';
