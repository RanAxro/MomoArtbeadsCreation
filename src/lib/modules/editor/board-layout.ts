export interface BoardLayout {
  edgeInset: number;
  contentX: number;
  contentY: number;
  contentWidth: number;
  contentHeight: number;
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

export interface BoardViewCenter {
  x: number;
  y: number;
}

export const MIN_BOARD_ZOOM = 0.5;
export const MAX_BOARD_ZOOM = 4;

export function clampBoardZoom(value: number): number {
  return Math.max(MIN_BOARD_ZOOM, Math.min(MAX_BOARD_ZOOM, value));
}

/**
 * Resolve the fit-to-view square cell grid with fixed ruler gutters.
 * Zoom and pan are applied on top of this base layout by the canvas.
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
  const edgeInset = Math.max(8, Math.min(16, Math.min(safeWidth, safeHeight) * 0.025));
  const contentX = edgeInset + rulerThickness + rulerGap;
  const contentY = contentX;
  const contentWidth = Math.max(1, safeWidth - contentX * 2);
  const contentHeight = Math.max(1, safeHeight - contentY * 2);
  const cellSize = Math.max(
    1,
    Math.min(
      contentWidth / safeColumns,
      contentHeight / safeRows
    )
  );
  const boardWidth = safeColumns * cellSize;
  const boardHeight = safeRows * cellSize;

  return {
    edgeInset,
    contentX,
    contentY,
    contentWidth,
    contentHeight,
    originX: contentX + (contentWidth - boardWidth) / 2,
    originY: contentY + (contentHeight - boardHeight) / 2,
    boardWidth,
    boardHeight,
    cellSize,
    rulerThickness,
    rulerGap
  };
}

export function clampViewCenter(
  layout: BoardLayout,
  zoom: number,
  center: BoardViewCenter
): BoardViewCenter {
  const safeZoom = clampBoardZoom(zoom);
  const zoomedWidth = layout.boardWidth * safeZoom;
  const zoomedHeight = layout.boardHeight * safeZoom;
  const halfContentWidth = layout.contentWidth / 2 / safeZoom;
  const halfContentHeight = layout.contentHeight / 2 / safeZoom;
  const xMin =
    zoomedWidth >= layout.contentWidth
      ? halfContentWidth
      : layout.boardWidth - halfContentWidth;
  const xMax =
    zoomedWidth >= layout.contentWidth
      ? layout.boardWidth - halfContentWidth
      : halfContentWidth;
  const yMin =
    zoomedHeight >= layout.contentHeight
      ? halfContentHeight
      : layout.boardHeight - halfContentHeight;
  const yMax =
    zoomedHeight >= layout.contentHeight
      ? layout.boardHeight - halfContentHeight
      : halfContentHeight;

  return {
    x: Math.max(xMin, Math.min(xMax, center.x)),
    y: Math.max(yMin, Math.min(yMax, center.y))
  };
}

export function boardOriginForView(
  layout: BoardLayout,
  zoom: number,
  center: BoardViewCenter
): { x: number; y: number } {
  const safeZoom = clampBoardZoom(zoom);

  return {
    x: layout.contentX + layout.contentWidth / 2 - center.x * safeZoom,
    y: layout.contentY + layout.contentHeight / 2 - center.y * safeZoom
  };
}

export function cellFromCanvasPoint(
  layout: BoardLayout,
  columns: number,
  rows: number,
  canvasX: number,
  canvasY: number
): BoardCell | null {
  if (
    canvasX < layout.contentX ||
    canvasY < layout.contentY ||
    canvasX > layout.contentX + layout.contentWidth ||
    canvasY > layout.contentY + layout.contentHeight
  ) {
    return null;
  }

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
