import type { BeadProject } from './project.model';
import type { SelectionBounds } from './selection.model';

export interface SelectionClipboard {
  id: string;
  version: number;
  copiedAt: string;
  lastUsedAt?: string;
  sourceProjectId: string;
  sourceBounds: SelectionBounds;
  project: BeadProject;
  selectionCells: number[];
}

export const SELECTION_CLIPBOARD_VERSION = 1;
export const SELECTION_CLIPBOARD_NAME_SUFFIX = ' 框选';
export const DEFAULT_CLIPBOARD_HISTORY_LIMIT = 5;
export const MIN_CLIPBOARD_HISTORY_LIMIT = 1;
export const MAX_CLIPBOARD_HISTORY_LIMIT = 50;
export const CLIPBOARD_HISTORY_LIMIT_STORAGE_KEY =
  'momo-artbeads.clipboard-history-limit';
