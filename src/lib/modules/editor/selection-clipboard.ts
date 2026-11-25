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
  SELECTION_CLIPBOARD_NAME_SUFFIX,
  SELECTION_CLIPBOARD_VERSION,
  SelectionClipboardRecordId,
  type SelectionClipboard
} from '$model/selection-clipboard.model';
import { getSelectionBounds } from './selection';

export interface SelectionPasteResult {
  cells: number[];
  palette: BeadPalette;
  selection: ReadonlySet<number>;
  targetX: number;
  targetY: number;
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
    id: SelectionClipboardRecordId.Active,
    version: SELECTION_CLIPBOARD_VERSION,
    copiedAt: now,
    sourceProjectId: project.id,
    sourceBounds: bounds,
    project: {
      id: crypto.randomUUID(),
      name: `${project.name}${SELECTION_CLIPBOARD_NAME_SUFFIX}`,
      gameVersion: project.gameVersion,
      width: bounds.width,
      height: bounds.height,
      cells: copiedCells,
      palette: clonePalette(project.palette),
      schemaVersion: project.schemaVersion,
      createdAt: now,
      updatedAt: now
    },
    selectionCells
  };
}

export function pasteSelectionClipboard(
  project: BeadProject,
  clipboard: SelectionClipboard,
  visibleCenter: BoardViewCenter
): SelectionPasteResult | null {
  const clipboardProject = clipboard.project;
  if (
    clipboardProject.width <= 0 ||
    clipboardProject.height <= 0 ||
    clipboardProject.cells.length !==
      clipboardProject.width * clipboardProject.height
  ) {
    return null;
  }

  const cells = [...project.cells];
  const palette = clonePalette(project.palette);
  const selection = new Set<number>();
  const targetX = Math.round(visibleCenter.x - clipboardProject.width / 2);
  const targetY = Math.round(visibleCenter.y - clipboardProject.height / 2);
  const colorMap = new Map<number, number>();

  for (const clipboardIndex of clipboard.selectionCells) {
    if (
      clipboardIndex < 0 ||
      clipboardIndex >= clipboardProject.cells.length
    ) {
      continue;
    }

    const clipboardX = clipboardIndex % clipboardProject.width;
    const clipboardY = Math.floor(clipboardIndex / clipboardProject.width);
    const destinationX = targetX + clipboardX;
    const destinationY = targetY + clipboardY;
    if (
      destinationX < 0 ||
      destinationY < 0 ||
      destinationX >= project.width ||
      destinationY >= project.height
    ) {
      continue;
    }

    const sourceColorIndex = clipboardProject.cells[clipboardIndex];
    if (sourceColorIndex === EMPTY_CELL_COLOR_INDEX) {
      cells[destinationY * project.width + destinationX] =
        EMPTY_CELL_COLOR_INDEX;
      selection.add(destinationY * project.width + destinationX);
      continue;
    }

    let destinationColorIndex = colorMap.get(sourceColorIndex);
    if (destinationColorIndex === undefined) {
      destinationColorIndex = resolveClipboardColor(
        clipboardProject.palette,
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
    targetX,
    targetY,
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
