import { z } from 'zod';
import { paletteSchema } from './palette.model';
import type { SelectionBounds } from './selection.model';

export const clipboardBoardSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  cells: z.array(z.number().int().nonnegative()),
  palette: paletteSchema
});

export type ClipboardBoardData = z.infer<typeof clipboardBoardSchema>;

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

export const SELECTION_CLIPBOARD_VERSION = 1;
export const DEFAULT_CLIPBOARD_HISTORY_LIMIT = 5;
export const MIN_CLIPBOARD_HISTORY_LIMIT = 1;
export const MAX_CLIPBOARD_HISTORY_LIMIT = 50;
export const CLIPBOARD_HISTORY_LIMIT_STORAGE_KEY =
  'momo-artbeads.clipboard-history-limit';
