import {
  clonePalette,
  createColorIndex,
  nearestPaletteIndex
} from '$domain/palette';
import { hexToRgb } from '$domain/color';
import type { BoardViewCenter } from '$model/editor.model';
import {
  PALETTE_MAX_COLORS,
  type BeadPalette
} from '$model/palette.model';
import {
  EMPTY_CELL_COLOR_INDEX,
  type BeadProject
} from '$model/project.model';
import {
  SELECTION_CLIPBOARD_VERSION,
  type SelectionClipboard
} from '$model/selection-clipboard.model';
import type { SelectionLayer } from '$model/selection-layer.model';
import { getSelectionBounds } from './selection';

export interface SelectionPasteResult {
  cells: number[];
  palette: BeadPalette;
  selection: ReadonlySet<number>;
  changed: boolean;
}

export function createSelectionClipboard(
  project: BeadProject,
  selectedCells: ReadonlySet<number>
): SelectionClipboard | null {
  const bounds = getSelectionBounds(
    selectedCells,
    project.width,
    project.height
  );
  if (!bounds) {
    return null;
  }

  const copiedCells = Array.from(
    { length: bounds.width * bounds.height },
    () => EMPTY_CELL_COLOR_INDEX
  );
  const selectionCells: number[] = [];

  for (let y = 0; y < bounds.height; y += 1) {
    for (let x = 0; x < bounds.width; x += 1) {
      const sourceIndex =
        (bounds.minY + y) * project.width + bounds.minX + x;
      const clipboardIndex = y * bounds.width + x;
      copiedCells[clipboardIndex] = project.cells[sourceIndex] ??
        EMPTY_CELL_COLOR_INDEX;
      if (selectedCells.has(sourceIndex)) {
        selectionCells.push(clipboardIndex);
      }
    }
  }

  if (selectionCells.length === 0) {
    return null;
  }

  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    version: SELECTION_CLIPBOARD_VERSION,
    copiedAt: now,
    lastUsedAt: now,
    sourceProjectId: project.id,
    sourceBounds: bounds,
    board: {
      width: bounds.width,
      height: bounds.height,
      cells: copiedCells,
      palette: clonePalette(project.palette)
    },
    selectionCells
  };
}

export function createSelectionLayer(
  clipboard: SelectionClipboard,
  visibleCenter: BoardViewCenter
): SelectionLayer | null {
  const clipboardBoard = clipboard.board;
  if (
    clipboardBoard.width <= 0 ||
    clipboardBoard.height <= 0 ||
    clipboardBoard.cells.length !==
      clipboardBoard.width * clipboardBoard.height ||
    clipboard.selectionCells.length === 0
  ) {
    return null;
  }

  return {
    width: clipboardBoard.width,
    height: clipboardBoard.height,
    cells: [...clipboardBoard.cells],
    palette: clonePalette(clipboardBoard.palette),
    selectionCells: [...clipboard.selectionCells],
    x: Math.round(visibleCenter.x - clipboardBoard.width / 2),
    y: Math.round(visibleCenter.y - clipboardBoard.height / 2)
  };
}

export function cloneSelectionLayer(layer: SelectionLayer): SelectionLayer {
  return {
    width: layer.width,
    height: layer.height,
    cells: [...layer.cells],
    palette: clonePalette(layer.palette),
    selectionCells: [...layer.selectionCells],
    x: layer.x,
    y: layer.y
  };
}

export function getVisibleLayerSelection(
  layer: SelectionLayer,
  projectWidth: number,
  projectHeight: number
): ReadonlySet<number> {
  const selection = new Set<number>();

  for (const layerIndex of layer.selectionCells) {
    if (layerIndex < 0 || layerIndex >= layer.cells.length) {
      continue;
    }
    const layerX = layerIndex % layer.width;
    const layerY = Math.floor(layerIndex / layer.width);
    const projectX = layer.x + layerX;
    const projectY = layer.y + layerY;
    if (
      projectX < 0 ||
      projectY < 0 ||
      projectX >= projectWidth ||
      projectY >= projectHeight
    ) {
      continue;
    }
    selection.add(projectY * projectWidth + projectX);
  }

  return selection;
}

export function moveSelectionLayer(
  layer: SelectionLayer,
  x: number,
  y: number,
  projectWidth: number,
  projectHeight: number
): SelectionLayer {
  const bounds = getSelectionBounds(
    new Set(layer.selectionCells),
    layer.width,
    layer.height
  );
  if (!bounds || projectWidth <= 0 || projectHeight <= 0) {
    return layer;
  }

  return {
    ...layer,
    x: Math.max(
      -bounds.maxX,
      Math.min(projectWidth - 1 - bounds.minX, Math.round(x))
    ),
    y: Math.max(
      -bounds.maxY,
      Math.min(projectHeight - 1 - bounds.minY, Math.round(y))
    )
  };
}

export function mergeSelectionLayer(
  project: BeadProject,
  layer: SelectionLayer
): SelectionPasteResult | null {
  const cells = [...project.cells];
  const palette = clonePalette(project.palette);
  const selection = new Set<number>();
  const colorMap = new Map<number, number>();

  for (const layerIndex of layer.selectionCells) {
    if (
      layerIndex < 0 ||
      layerIndex >= layer.cells.length
    ) {
      continue;
    }

    const layerX = layerIndex % layer.width;
    const layerY = Math.floor(layerIndex / layer.width);
    const destinationX = layer.x + layerX;
    const destinationY = layer.y + layerY;
    if (
      destinationX < 0 ||
      destinationY < 0 ||
      destinationX >= project.width ||
      destinationY >= project.height
    ) {
      continue;
    }

    const sourceColorIndex = layer.cells[layerIndex];
    if (sourceColorIndex === EMPTY_CELL_COLOR_INDEX) {
      cells[destinationY * project.width + destinationX] =
        EMPTY_CELL_COLOR_INDEX;
      selection.add(destinationY * project.width + destinationX);
      continue;
    }

    let destinationColorIndex = colorMap.get(sourceColorIndex);
    if (destinationColorIndex === undefined) {
      destinationColorIndex = resolveClipboardColor(
        layer.palette,
        sourceColorIndex,
        palette
      );
      colorMap.set(sourceColorIndex, destinationColorIndex);
    }

    const destinationIndex = destinationY * project.width + destinationX;
    cells[destinationIndex] = destinationColorIndex;
    selection.add(destinationIndex);
  }

  if (selection.size === 0) {
    return null;
  }

  const changed =
    cells.some((cell, index) => cell !== project.cells[index]) ||
    palette.colors.length !== project.palette.colors.length;

  return {
    cells,
    palette,
    selection,
    changed
  };
}

function resolveClipboardColor(
  sourcePalette: BeadPalette,
  sourceColorIndex: number,
  destinationPalette: BeadPalette
): number {
  const sourceColor = sourcePalette.colors[sourceColorIndex - 1];
  if (!sourceColor) {
    return EMPTY_CELL_COLOR_INDEX;
  }

  const normalizedHex = sourceColor.hex.toUpperCase();
  const existingIndex = destinationPalette.colors.findIndex(
    (color) => color.hex.toUpperCase() === normalizedHex
  );
  if (existingIndex >= 0) {
    return existingIndex + 1;
  }

  if (destinationPalette.colors.length < PALETTE_MAX_COLORS) {
    destinationPalette.colors.push({
      ...sourceColor,
      id: `${destinationPalette.id}-paste-${crypto.randomUUID()}`
    });
    return destinationPalette.colors.length;
  }

  return nearestPaletteIndex(
    createColorIndex(destinationPalette),
    hexToRgb(sourceColor.hex)
  );
}
