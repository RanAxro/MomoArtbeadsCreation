import { hexToRgb, isHexColor } from '$domain/color';
import {
  BLACK_HEX,
  LUMINANCE_THRESHOLD,
  RGB_LUMINANCE_WEIGHTS,
  WHITE_HEX
} from '$model/color.model';
import {
  BOARD_LAYOUT,
  MAX_BOARD_ZOOM,
  MIN_BOARD_ZOOM,
  type BoardCell,
  type BoardLayout,
  type BoardViewCenter
} from '$model/editor.model';

export type { BoardCell, BoardLayout, BoardViewCenter } from '$model/editor.model';
export { MAX_BOARD_ZOOM, MIN_BOARD_ZOOM } from '$model/editor.model';

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
  const safeWidth = Math.max(BOARD_LAYOUT.minCanvasSize, frameWidth);
  const safeHeight = Math.max(BOARD_LAYOUT.minCanvasSize, frameHeight);
  const safeColumns = Math.max(BOARD_LAYOUT.minCanvasSize, columns);
  const safeRows = Math.max(BOARD_LAYOUT.minCanvasSize, rows);
  const frameSize = Math.min(safeWidth, safeHeight);
  const rulerThickness = Math.max(
    BOARD_LAYOUT.minRulerThickness,
    Math.min(
      BOARD_LAYOUT.maxRulerThickness,
      frameSize * BOARD_LAYOUT.rulerThicknessRatio
    )
  );
  const rulerGap = BOARD_LAYOUT.rulerGap;
  const edgeInset = Math.max(
    BOARD_LAYOUT.minEdgeInset,
    Math.min(
      BOARD_LAYOUT.maxEdgeInset,
      frameSize * BOARD_LAYOUT.edgeInsetRatio
    )
  );
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

export function contrastingOutline(fill: string): typeof BLACK_HEX | typeof WHITE_HEX {
  if (!isHexColor(fill)) {
    return BLACK_HEX;
  }

  const { r, g, b } = hexToRgb(fill);
  const luminance =
    r * RGB_LUMINANCE_WEIGHTS.red +
    g * RGB_LUMINANCE_WEIGHTS.green +
    b * RGB_LUMINANCE_WEIGHTS.blue;

  return luminance >= LUMINANCE_THRESHOLD ? BLACK_HEX : WHITE_HEX;
}
