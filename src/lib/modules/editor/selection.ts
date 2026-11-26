import type { BoardCell } from '$model/editor.model';
import { EMPTY_CELL_COLOR_INDEX } from '$model/project.model';
import {
  SelectionOperation,
  type SelectionBounds,
  type SelectionRectangle
} from '$model/selection.model';

export type {
  SelectionOperation,
  SelectionBounds,
  SelectionRectangle
} from '$model/selection.model';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getSelectionBounds(
  cells: ReadonlySet<number>,
  columns: number,
  rows: number
): SelectionBounds | null {
  if (columns <= 0 || rows <= 0 || cells.size === 0) {
    return null;
  }

  let minX = columns;
  let minY = rows;
  let maxX = -1;
  let maxY = -1;

  for (const index of cells) {
    if (index < 0 || index >= columns * rows) {
      continue;
    }
    const x = index % columns;
    const y = Math.floor(index / columns);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

export function createSelectionRectangle(
  start: BoardCell,
  end: BoardCell,
  columns: number,
  rows: number,
  square: boolean
): SelectionRectangle {
  const safeColumns = Math.max(1, columns);
  const safeRows = Math.max(1, rows);
  const startX = clamp(Math.trunc(start.x), 0, safeColumns - 1);
  const startY = clamp(Math.trunc(start.y), 0, safeRows - 1);
  let endX = clamp(Math.trunc(end.x), 0, safeColumns - 1);
  let endY = clamp(Math.trunc(end.y), 0, safeRows - 1);

  if (square) {
    const directionX = endX < startX ? -1 : 1;
    const directionY = endY < startY ? -1 : 1;
    const availableX =
      directionX > 0 ? safeColumns - 1 - startX : startX;
    const availableY =
      directionY > 0 ? safeRows - 1 - startY : startY;
    const side = Math.min(
      Math.max(Math.abs(endX - startX), Math.abs(endY - startY)) + 1,
      availableX + 1,
      availableY + 1
    );

    endX = startX + directionX * (side - 1);
    endY = startY + directionY * (side - 1);
  }

  const minX = Math.min(startX, endX);
  const minY = Math.min(startY, endY);
  const maxX = Math.max(startX, endX);
  const maxY = Math.max(startY, endY);
  const cells = new Set<number>();

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      cells.add(y * safeColumns + x);
    }
  }

  return {
    start: {
      x: startX,
      y: startY,
      index: startY * safeColumns + startX
    },
    end: {
      x: endX,
      y: endY,
      index: endY * safeColumns + endX
    },
    minX,
    minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    cells
  };
}

export function getSameColorSelection(
  cells: readonly number[],
  colors: readonly { hex: string }[],
  colorIndex: number
): ReadonlySet<number> {
  const selection = new Set<number>();
  if (colorIndex === EMPTY_CELL_COLOR_INDEX) {
    for (let index = 0; index < cells.length; index += 1) {
      if (cells[index] === EMPTY_CELL_COLOR_INDEX) {
        selection.add(index);
      }
    }
    return selection;
  }

  const selectedColor =
    colorIndex > 0 ? colors[colorIndex - 1] : undefined;

  if (!selectedColor) {
    return selection;
  }

  const normalizedHex = selectedColor.hex.trim().toLowerCase();
  for (let index = 0; index < cells.length; index += 1) {
    const candidateColorIndex = cells[index];
    if (candidateColorIndex === EMPTY_CELL_COLOR_INDEX) {
      continue;
    }

    const candidateColor = colors[candidateColorIndex - 1];
    if (
      candidateColor &&
      candidateColor.hex.trim().toLowerCase() === normalizedHex
    ) {
      selection.add(index);
    }
  }

  return selection;
}

export function eraseSelectedCells(
  cells: readonly number[],
  selectedCells: ReadonlySet<number>
): { cells: number[]; changed: boolean } {
  const next = [...cells];
  let changed = false;

  for (const index of selectedCells) {
    if (
      index >= 0 &&
      index < next.length &&
      next[index] !== 0
    ) {
      next[index] = 0;
      changed = true;
    }
  }

  return { cells: next, changed };
}

export function combineSelections(
  previous: ReadonlySet<number>,
  rectangle: ReadonlySet<number>,
  operation: SelectionOperation
): ReadonlySet<number> {
  if (operation === SelectionOperation.Replace) {
    return new Set(rectangle);
  }

  const next = new Set<number>();

  if (operation === SelectionOperation.Union) {
    for (const index of previous) {
      next.add(index);
    }
    for (const index of rectangle) {
      next.add(index);
    }
    return next;
  }

  if (operation === SelectionOperation.Subtract) {
    for (const index of previous) {
      if (!rectangle.has(index)) {
        next.add(index);
      }
    }
    return next;
  }

  if (operation === SelectionOperation.Intersect) {
    for (const index of rectangle) {
      if (previous.has(index)) {
        next.add(index);
      }
    }
    return next;
  }

  for (const index of previous) {
    if (!rectangle.has(index)) {
      next.add(index);
    }
  }
  for (const index of rectangle) {
    if (!previous.has(index)) {
      next.add(index);
    }
  }
  return next;
}
