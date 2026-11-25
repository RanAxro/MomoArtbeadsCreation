import type { BeadPalette } from './palette.model';

export interface SelectionLayer {
  width: number;
  height: number;
  cells: number[];
  palette: BeadPalette;
  selectionCells: number[];
  x: number;
  y: number;
}
