import type { BeadProject } from './project.model';
import type { SelectionBounds } from './selection.model';

export enum SelectionClipboardRecordId {
  Active = 'active'
}

export interface SelectionClipboard {
  id: SelectionClipboardRecordId;
  version: number;
  copiedAt: string;
  sourceProjectId: string;
  sourceBounds: SelectionBounds;
  project: BeadProject;
  selectionCells: number[];
}

export const SELECTION_CLIPBOARD_VERSION = 1;
export const SELECTION_CLIPBOARD_NAME_SUFFIX = ' 框选';
