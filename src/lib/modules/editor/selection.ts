import type { BoardCell } from '$model/editor.model';
import {
  SelectionOperation,
  type SelectionRectangle
} from '$model/selection.model';

export type {
  SelectionOperation,
  SelectionRectangle
} from '$model/selection.model';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
