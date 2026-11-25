export interface BoardLayout {
  originX: number;
  originY: number;
  boardWidth: number;
  boardHeight: number;
  cellSize: number;
  rulerThickness: number;
  rulerGap: number;
}

export interface BoardCell {
  x: number;
  y: number;
  index: number;
}

/**
 * Resolve the square cell grid while reserving room for all four rulers.
 * The ruler bands sit outside the board so their ticks cannot obscure artwork.
 */
export function calculateBoardLayout(
  frameWidth: number,
  frameHeight: number,
  columns: number,
  rows: number
): BoardLayout {
  const safeWidth = Math.max(1, frameWidth);
  const safeHeight = Math.max(1, frameHeight);
  const safeColumns = Math.max(1, columns);
  const safeRows = Math.max(1, rows);
  const rulerThickness = Math.max(18, Math.min(24, Math.min(safeWidth, safeHeight) * 0.045));
  const rulerGap = 4;
  const outerInset = Math.max(8, Math.min(16, Math.min(safeWidth, safeHeight) * 0.025));
  const reservedEdge = outerInset + rulerThickness + rulerGap;
  const cellSize = Math.max(
    1,
    Math.min(
      (safeWidth - reservedEdge * 2) / safeColumns,
      (safeHeight - reservedEdge * 2) / safeRows
    )
  );
  const boardWidth = safeColumns * cellSize;
  const boardHeight = safeRows * cellSize;

  return {
    originX: (safeWidth - boardWidth) / 2,
    originY: (safeHeight - boardHeight) / 2,
    boardWidth,
    boardHeight,
    cellSize,
    rulerThickness,
    rulerGap
  };
}

export function cellFromCanvasPoint(
  layout: BoardLayout,
  columns: number,
  rows: number,
  canvasX: number,
  canvasY: number
): BoardCell | null {
  const gridX = Math.floor((canvasX - layout.originX) / layout.cellSize);
  const gridY = Math.floor((canvasY - layout.originY) / layout.cellSize);

  if (gridX < 0 || gridY < 0 || gridX >= columns || gridY >= rows) {
    return null;
  }

  return {
    x: gridX,
    y: gridY,
    index: gridY * columns + gridX
  };
}

export function contrastingOutline(fill: string): '#000000' | '#FFFFFF' {
  const normalized = fill.replace('#', '');
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((digit) => `${digit}${digit}`)
          .join('')
      : normalized;

  if (!/^[\dA-Fa-f]{6}$/.test(expanded)) {
    return '#000000';
  }

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  const luminance = red * 0.299 + green * 0.587 + blue * 0.114;

  return luminance >= 150 ? '#000000' : '#FFFFFF';
}
