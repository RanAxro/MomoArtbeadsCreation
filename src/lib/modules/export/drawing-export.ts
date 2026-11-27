import {
  artbeadDisplayCode,
  DRAWING_EXPORT_MAX_DIMENSION,
  DRAWING_EXPORT_MAX_PIXELS,
  type DrawingExportSettings
} from '$model/drawing-export.model';
import { BeadShape } from '$model/bead-shape.model';
import type { BeadProject } from '$model/project.model';
import { BoardBackground } from '$model/view.model';
import { requiredArtbeadUsage } from '$domain/project';

export interface DrawingSheetLabels {
  basicInfoTitle: string;
  schemeNameLabel: string;
  boardSizeLabel: string;
  beadShapeLabel: string;
  boardSizeValue: string;
  beadShapeValue: string;
  legendTitle: string;
  emptyLegend: string;
}

export interface RenderDrawingSheetOptions {
  labels: DrawingSheetLabels;
  maxDimension?: number;
  maxPixels?: number;
}

export interface DrawingSheetRenderInfo {
  width: number;
  height: number;
  scale: number;
}

export interface DrawingSheetLayout {
  cellSize: number;
  rulerSize: number;
  legendColumns: number;
  legendRows: number;
  legendPanelHeight: number;
  legendItemHeight: number;
  legendPanelY: number;
  basicInfoHeight: number;
  boardWidth: number;
  boardHeight: number;
  boardViewportX: number;
  boardViewportY: number;
  boardViewportWidth: number;
  boardViewportHeight: number;
  boardX: number;
  boardY: number;
  logicalWidth: number;
  logicalHeight: number;
}

const SHEET_WIDTH = 1600;
const SHEET_HEIGHT = 1200;
const SHEET_MARGIN = 24;
const SIDE_PANEL_WIDTH = 300;
const SIDE_PANEL_GAP = 24;
const PANEL_GAP = 16;
const BASIC_INFO_HEIGHT = 240;
const LEGEND_PADDING = 21;
const LEGEND_HEADING_HEIGHT = 70;
const LEGEND_ITEM_HEIGHT_MIN = 18;
const LEGEND_ITEM_HEIGHT_MAX = 45;
const BOARD_CELL_MIN = 1;
const BOARD_CELL_MAX = 64;
const RULER_SIZE = 36;

const INK = '#111111';
const MUTED = '#6b6b68';
const BORDER = '#c9c9c4';
const HAIRLINE = '#d9d9d5';
const PAPER = '#ffffff';
const SOFT_PAPER = '#fafaf8';
const CHECKER_LIGHT = '#f5f5f2';
const CHECKER_DARK = '#deded9';
const GRID_LINE = 'rgba(0, 0, 0, 0.17)';
const COARSE_GRID_LINE = 'rgba(0, 0, 0, 0.52)';

function legendColumnCount(itemCount: number): number {
  if (itemCount >= 241) {
    return 6;
  }
  if (itemCount >= 97) {
    return 5;
  }
  if (itemCount >= 17) {
    return 4;
  }
  if (itemCount >= 9) {
    return 3;
  }
  if (itemCount >= 5) {
    return 2;
  }
  return 1;
}

export function calculateDrawingSheetLayout(
  project: BeadProject,
  settings: DrawingExportSettings
): DrawingSheetLayout {
  const usedColorCount = requiredArtbeadUsage(project).length;
  const legendColumns = legendColumnCount(usedColorCount);
  const legendRows = Math.ceil(usedColorCount / legendColumns);
  const legendPanelHeight =
    SHEET_HEIGHT -
    SHEET_MARGIN * 2 -
    BASIC_INFO_HEIGHT -
    PANEL_GAP;
  const legendBodyHeight =
    legendPanelHeight - LEGEND_HEADING_HEIGHT - LEGEND_PADDING;
  const legendItemHeight =
    usedColorCount > 0
      ? Math.min(
          LEGEND_ITEM_HEIGHT_MAX,
          Math.max(
            LEGEND_ITEM_HEIGHT_MIN,
            Math.floor(legendBodyHeight / legendRows)
          )
        )
      : LEGEND_ITEM_HEIGHT_MAX;
  const rulerSize = settings.showRulers ? RULER_SIZE : 0;
  const rightAreaX =
    SHEET_MARGIN + SIDE_PANEL_WIDTH + SIDE_PANEL_GAP;
  const rightAreaWidth = SHEET_WIDTH - SHEET_MARGIN - rightAreaX;
  const contentHeight = SHEET_HEIGHT - SHEET_MARGIN * 2;
  const cellSize = Math.max(
    BOARD_CELL_MIN,
    Math.min(
      BOARD_CELL_MAX,
      Math.floor(
        (rightAreaWidth - rulerSize * 2) / project.width
      ),
      Math.floor(
        (contentHeight - rulerSize * 2) / project.height
      )
    )
  );
  const boardWidth = project.width * cellSize;
  const boardHeight = project.height * cellSize;
  const boardViewportWidth = boardWidth + rulerSize * 2;
  const boardViewportHeight = boardHeight + rulerSize * 2;
  const legendPanelY =
    SHEET_MARGIN + BASIC_INFO_HEIGHT + PANEL_GAP;
  const boardViewportX =
    rightAreaX +
    Math.max(0, (rightAreaWidth - boardViewportWidth) / 2);
  const boardViewportY =
    SHEET_MARGIN +
    Math.max(0, (contentHeight - boardViewportHeight) / 2);
  const boardX = boardViewportX + rulerSize;
  const boardY = boardViewportY + rulerSize;

  return {
    cellSize,
    rulerSize,
    legendColumns,
    legendRows,
    legendPanelHeight,
    legendItemHeight,
    legendPanelY,
    basicInfoHeight: BASIC_INFO_HEIGHT,
    boardWidth,
    boardHeight,
    boardViewportX,
    boardViewportY,
    boardViewportWidth,
    boardViewportHeight,
    boardX,
    boardY,
    logicalWidth: SHEET_WIDTH,
    logicalHeight: SHEET_HEIGHT
  };
}

function setFont(
  context: CanvasRenderingContext2D,
  size: number,
  weight: 400 | 500 | 600 | 700 = 400
): void {
  context.font = `${weight} ${size}px "Noto Sans SC", "Microsoft YaHei", sans-serif`;
}

function fitText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (context.measureText(text).width <= maxWidth) {
    return text;
  }

  const ellipsis = '…';
  let low = 0;
  let high = text.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = `${text.slice(0, middle)}${ellipsis}`;
    if (context.measureText(candidate).width <= maxWidth) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low > 0 ? `${text.slice(0, low)}${ellipsis}` : ellipsis;
}

function traceBeadShape(
  context: CanvasRenderingContext2D,
  shape: BeadShape,
  x: number,
  y: number,
  size: number
): void {
  context.beginPath();
  if (shape === BeadShape.Square) {
    context.rect(x, y, size, size);
    return;
  }

  const centerX = x + size / 2;
  const centerY = y + size / 2;
  if (shape === BeadShape.Circle) {
    context.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
    return;
  }

  for (let index = 0; index < 6; index += 1) {
    const angle = Math.PI / 6 + (Math.PI / 3) * index;
    const pointX = centerX + Math.cos(angle) * (size / 2);
    const pointY = centerY + Math.sin(angle) * (size / 2);
    if (index === 0) {
      context.moveTo(pointX, pointY);
    } else {
      context.lineTo(pointX, pointY);
    }
  }
  context.closePath();
}

function fillTracedBeadShape(
  context: CanvasRenderingContext2D,
  shape: BeadShape,
  x: number,
  y: number,
  size: number
): void {
  traceBeadShape(context, shape, x, y, size);
  context.fill();
}

function drawBoardBackground(
  context: CanvasRenderingContext2D,
  project: BeadProject,
  cellSize: number,
  boardX: number,
  boardY: number,
  background: BoardBackground
): void {
  context.fillStyle = PAPER;
  context.fillRect(
    boardX,
    boardY,
    project.width * cellSize,
    project.height * cellSize
  );

  if (background === BoardBackground.Solid) {
    return;
  }

  if (background === BoardBackground.Checker) {
    for (let y = 0; y < project.height; y += 1) {
      for (let x = 0; x < project.width; x += 1) {
        context.fillStyle =
          (x + y) % 2 === 0 ? CHECKER_LIGHT : CHECKER_DARK;
        context.fillRect(
          boardX + x * cellSize,
          boardY + y * cellSize,
          cellSize,
          cellSize
        );
      }
    }
    return;
  }

  const halfCell = cellSize / 2;
  for (let y = 0; y < project.height; y += 1) {
    for (let x = 0; x < project.width; x += 1) {
      for (let subY = 0; subY < 2; subY += 1) {
        for (let subX = 0; subX < 2; subX += 1) {
          context.fillStyle =
            (x * 2 + subX + y * 2 + subY) % 2 === 0
              ? CHECKER_LIGHT
              : CHECKER_DARK;
          context.fillRect(
            boardX + x * cellSize + subX * halfCell,
            boardY + y * cellSize + subY * halfCell,
            halfCell,
            halfCell
          );
        }
      }
    }
  }
}

function drawArtbeads(
  context: CanvasRenderingContext2D,
  project: BeadProject,
  cellSize: number,
  boardX: number,
  boardY: number
): void {
  const inset = cellSize >= 9 ? Math.max(0.7, cellSize * 0.06) : 0;
  const beadSize = Math.max(1, cellSize - inset * 2);

  for (let y = 0; y < project.height; y += 1) {
    for (let x = 0; x < project.width; x += 1) {
      const colorIndex = project.cells[y * project.width + x];
      if (!colorIndex) {
        continue;
      }
      const color = project.palette.colors[colorIndex - 1];
      if (!color) {
        continue;
      }

      const paintX = boardX + x * cellSize + inset;
      const paintY = boardY + y * cellSize + inset;
      context.fillStyle = color.hex;
      fillTracedBeadShape(
        context,
        project.beadShape,
        paintX,
        paintY,
        beadSize
      );

      if (cellSize >= 12) {
        context.strokeStyle = 'rgba(0, 0, 0, 0.22)';
        context.lineWidth = 0.7;
        traceBeadShape(
          context,
          project.beadShape,
          paintX,
          paintY,
          beadSize
        );
        context.stroke();
      }
    }
  }
}

function drawGrid(
  context: CanvasRenderingContext2D,
  project: BeadProject,
  settings: DrawingExportSettings,
  cellSize: number,
  boardX: number,
  boardY: number
): void {
  const boardWidth = project.width * cellSize;
  const boardHeight = project.height * cellSize;

  if (settings.showGrid) {
    context.beginPath();
    for (let x = 0; x <= project.width; x += 1) {
      const lineX = boardX + x * cellSize;
      context.moveTo(lineX, boardY);
      context.lineTo(lineX, boardY + boardHeight);
    }
    for (let y = 0; y <= project.height; y += 1) {
      const lineY = boardY + y * cellSize;
      context.moveTo(boardX, lineY);
      context.lineTo(boardX + boardWidth, lineY);
    }
    context.strokeStyle = GRID_LINE;
    context.lineWidth = cellSize >= 16 ? 1 : 0.75;
    context.stroke();
  }

  if (settings.showCoarseGrid) {
    const spacing = Math.max(1, Math.round(settings.coarseGridSpacing));
    context.beginPath();
    for (let x = 0; x <= project.width; x += spacing) {
      const lineX = boardX + x * cellSize;
      context.moveTo(lineX, boardY);
      context.lineTo(lineX, boardY + boardHeight);
    }
    for (let y = 0; y <= project.height; y += spacing) {
      const lineY = boardY + y * cellSize;
      context.moveTo(boardX, lineY);
      context.lineTo(boardX + boardWidth, lineY);
    }
    context.strokeStyle = COARSE_GRID_LINE;
    context.lineWidth = 1.6;
    context.stroke();
  }

  context.strokeStyle = INK;
  context.lineWidth = 1.5;
  context.strokeRect(boardX, boardY, boardWidth, boardHeight);
}

export function calculateRulerFontSize(
  width: number,
  height: number,
  cellSize: number
): number {
  const maximumLabelLength = Math.max(
    String(width).length,
    String(height).length
  );
  return Math.min(
    13.5,
    Math.max(1, cellSize / (maximumLabelLength * 0.62))
  );
}

function drawRulers(
  context: CanvasRenderingContext2D,
  project: BeadProject,
  layout: DrawingSheetLayout
): void {
  if (layout.rulerSize <= 0) {
    return;
  }

  const {
    cellSize,
    boardX,
    boardY,
    boardWidth,
    boardHeight,
    rulerSize
  } = layout;
  const rulerFontSize = calculateRulerFontSize(
    project.width,
    project.height,
    cellSize
  );

  context.save();
  context.fillStyle = MUTED;
  context.strokeStyle = BORDER;
  context.lineWidth = 0.8;
  setFont(context, rulerFontSize, 500);
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  for (let x = 0; x < project.width; x += 1) {
    const centerX = boardX + x * cellSize + cellSize / 2;
    const label = String(x + 1);
    context.fillText(label, centerX, boardY - rulerSize / 2);
    context.fillText(
      label,
      centerX,
      boardY + boardHeight + rulerSize / 2
    );
    context.beginPath();
    context.moveTo(centerX, boardY - 4);
    context.lineTo(centerX, boardY);
    context.moveTo(centerX, boardY + boardHeight);
    context.lineTo(centerX, boardY + boardHeight + 4);
    context.stroke();
  }

  for (let y = 0; y < project.height; y += 1) {
    const centerY = boardY + y * cellSize + cellSize / 2;
    const label = String(y + 1);
    context.fillText(label, boardX - rulerSize / 2, centerY);
    context.fillText(
      label,
      boardX + boardWidth + rulerSize / 2,
      centerY
    );
    context.beginPath();
    context.moveTo(boardX - 4, centerY);
    context.lineTo(boardX, centerY);
    context.moveTo(boardX + boardWidth, centerY);
    context.lineTo(boardX + boardWidth + 4, centerY);
    context.stroke();
  }
  context.restore();
}

function drawBasicInfo(
  context: CanvasRenderingContext2D,
  project: BeadProject,
  layout: DrawingSheetLayout,
  labels: DrawingSheetLabels
): void {
  const x = SHEET_MARGIN;
  const y = SHEET_MARGIN;

  context.fillStyle = SOFT_PAPER;
  context.fillRect(x, y, SIDE_PANEL_WIDTH, layout.basicInfoHeight);
  context.strokeStyle = BORDER;
  context.lineWidth = 1;
  context.strokeRect(
    x + 0.5,
    y + 0.5,
    SIDE_PANEL_WIDTH - 1,
    layout.basicInfoHeight - 1
  );

  const contentX = x + 14;
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillStyle = INK;
  setFont(context, 25.5, 700);
  context.fillText(labels.basicInfoTitle, contentX, y + 40);
  context.strokeStyle = HAIRLINE;
  context.beginPath();
  context.moveTo(contentX, y + 56);
  context.lineTo(x + SIDE_PANEL_WIDTH - 14, y + 56);
  context.stroke();

  const valueWidth = SIDE_PANEL_WIDTH - 28;
  const rows = [
    {
      label: labels.schemeNameLabel,
      value: project.name
    },
    {
      label: labels.boardSizeLabel,
      value: labels.boardSizeValue
    },
    {
      label: labels.beadShapeLabel,
      value: labels.beadShapeValue
    }
  ];

  rows.forEach((row, index) => {
    const rowTop = y + 62 + index * 50;
    if (index > 0) {
      context.strokeStyle = HAIRLINE;
      context.lineWidth = 0.8;
      context.beginPath();
      context.moveTo(contentX, rowTop);
      context.lineTo(x + SIDE_PANEL_WIDTH - 14, rowTop);
      context.stroke();
    }
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.fillStyle = MUTED;
    setFont(context, 16.5, 600);
    context.fillText(row.label, contentX, rowTop + 20);
    context.fillStyle = INK;
    setFont(context, 21, 600);
    context.fillText(
      fitText(context, row.value, valueWidth),
      contentX,
      rowTop + 46
    );
  });
}

function drawLegend(
  context: CanvasRenderingContext2D,
  project: BeadProject,
  layout: DrawingSheetLayout,
  labels: DrawingSheetLabels
): void {
  const usedColors = requiredArtbeadUsage(project);
  const x = SHEET_MARGIN;
  const y = layout.legendPanelY;

  context.fillStyle = SOFT_PAPER;
  context.fillRect(x, y, SIDE_PANEL_WIDTH, layout.legendPanelHeight);
  context.strokeStyle = BORDER;
  context.lineWidth = 1;
  context.strokeRect(
    x + 0.5,
    y + 0.5,
    SIDE_PANEL_WIDTH - 1,
    layout.legendPanelHeight - 1
  );

  const contentX = x + LEGEND_PADDING;
  const contentWidth = SIDE_PANEL_WIDTH - LEGEND_PADDING * 2;
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillStyle = INK;
  setFont(context, 25.5, 700);
  context.fillText(labels.legendTitle, contentX, y + 43);
  context.strokeStyle = HAIRLINE;
  context.beginPath();
  context.moveTo(contentX, y + 58);
  context.lineTo(contentX + contentWidth, y + 58);
  context.stroke();

  if (usedColors.length === 0) {
    context.textBaseline = 'middle';
    context.fillStyle = MUTED;
    setFont(context, 18, 400);
    context.fillText(
      fitText(context, labels.emptyLegend, contentWidth),
      contentX,
      y + LEGEND_HEADING_HEIGHT + 28
    );
    return;
  }

  const itemWidth = contentWidth / layout.legendColumns;
  const swatchSize = Math.max(
    12,
    Math.min(24, layout.legendItemHeight - 8)
  );
  const maximumCodeFontSize = Math.max(
    13.5,
    Math.min(19.5, layout.legendItemHeight * 0.75)
  );
  const gridTop = y + LEGEND_HEADING_HEIGHT;

  usedColors.forEach((color, index) => {
    const column = index % layout.legendColumns;
    const row = Math.floor(index / layout.legendColumns);
    const itemX = contentX + column * itemWidth;
    const itemY = gridTop + row * layout.legendItemHeight;
    const centerY = itemY + layout.legendItemHeight / 2;
    const swatchX = itemX + 2;

    context.fillStyle = color.hex;
    fillTracedBeadShape(
      context,
      project.beadShape,
      swatchX,
      centerY - swatchSize / 2,
      swatchSize
    );
    context.strokeStyle = 'rgba(0, 0, 0, 0.28)';
    context.lineWidth = 0.8;
    traceBeadShape(
      context,
      project.beadShape,
      swatchX,
      centerY - swatchSize / 2,
      swatchSize
    );
    context.stroke();

    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillStyle = INK;
    const code = artbeadDisplayCode(color.code, color.hex);
    const codeWidth = itemWidth - swatchSize - 9;
    let codeFontSize = maximumCodeFontSize;
    setFont(context, codeFontSize, 700);
    while (
      codeFontSize > 10.5 &&
      context.measureText(code).width > codeWidth
    ) {
      codeFontSize = Math.max(10.5, codeFontSize - 0.5);
      setFont(context, codeFontSize, 700);
    }
    context.fillText(
      fitText(context, code, codeWidth),
      itemX + swatchSize + 7,
      centerY
    );
  });
}

/**
 * Draws the complete export sheet into a canvas. Preview and download both use
 * this renderer; only the output resolution changes.
 */
export function renderDrawingSheet(
  canvas: HTMLCanvasElement,
  project: BeadProject,
  settings: DrawingExportSettings,
  options: RenderDrawingSheetOptions
): DrawingSheetRenderInfo {
  const layout = calculateDrawingSheetLayout(project, settings);
  const maxDimension = options.maxDimension ?? DRAWING_EXPORT_MAX_DIMENSION;
  const maxPixels = options.maxPixels ?? DRAWING_EXPORT_MAX_PIXELS;
  const scale = Math.min(
    1,
    maxDimension / layout.logicalWidth,
    maxDimension / layout.logicalHeight,
    Math.sqrt(
      maxPixels / (layout.logicalWidth * layout.logicalHeight)
    )
  );
  const width = Math.max(1, Math.ceil(layout.logicalWidth * scale));
  const height = Math.max(1, Math.ceil(layout.logicalHeight * scale));

  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is unavailable.');
  }

  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.fillStyle = PAPER;
  context.fillRect(0, 0, layout.logicalWidth, layout.logicalHeight);

  drawBasicInfo(context, project, layout, options.labels);
  drawLegend(context, project, layout, options.labels);
  drawBoardBackground(
    context,
    project,
    layout.cellSize,
    layout.boardX,
    layout.boardY,
    settings.background
  );
  drawArtbeads(
    context,
    project,
    layout.cellSize,
    layout.boardX,
    layout.boardY
  );
  drawGrid(
    context,
    project,
    settings,
    layout.cellSize,
    layout.boardX,
    layout.boardY
  );
  drawRulers(context, project, layout);

  return { width, height, scale };
}
