import type { BoardCell } from './editor.model';

export enum SelectionOperation {
  Replace = 'replace',
  Union = 'union',
  Subtract = 'subtract',
  Xor = 'xor',
  Intersect = 'intersect'
}

export interface SelectionRectangle {
  start: BoardCell;
  end: BoardCell;
  minX: number;
  minY: number;
  width: number;
  height: number;
  cells: ReadonlySet<number>;
}

export const DEFAULT_SELECTION_COLOR = '#2f6fed';
export const DEFAULT_SELECTION_FILL = 'rgba(47, 111, 237, 0.32)';
export const SELECTION_OUTLINE_STYLE = {
  minWidth: 1,
  maxWidth: 2,
  widthRatio: 0.08
} as const;
export const SELECTION_DRAG_OUTLINE_STYLE = {
  minWidth: 1.25,
  maxWidth: 2.25,
  widthRatio: 0.1,
  minDashLength: 4,
  dashLengthRatio: 0.28,
  minGapLength: 3,
  gapLengthRatio: 0.2
} as const;
export const SELECTION_BASELINE_OUTLINE_STYLE = {
  minWidth: 1.5,
  maxWidth: 2.5,
  widthRatio: 0.1,
  minDashLength: 3,
  dashLengthRatio: 0.2,
  minGapLength: 2,
  gapLengthRatio: 0.14
} as const;
