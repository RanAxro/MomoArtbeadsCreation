import { createStarterPalette } from './palette';
import { DEFAULT_BEAD_SHAPE } from '$model/bead-shape.model';
import { DEFAULT_EDITOR_TOOL } from '$model/editor.model';
import { DEFAULT_PROJECT_PALETTE_SOURCE } from '$model/palette-source.model';
import {
  DEFAULT_GAME_VERSION,
  DEFAULT_PROJECT_NAME,
  EMPTY_CELL_COLOR_INDEX,
  MAX_PROJECT_DIMENSION,
  MAX_PROJECT_NAME_LENGTH,
  MIN_PROJECT_DIMENSION,
  PROJECT_SCHEMA_VERSION,
  type BeadProject,
  type NewProjectOptions
} from '$model/project.model';

export {
  beadProjectSchema,
  DEFAULT_GAME_VERSION,
  DEFAULT_PROJECT_NAME,
  MAX_PROJECT_DIMENSION,
  MAX_PROJECT_NAME_LENGTH,
  MIN_PROJECT_DIMENSION,
  PROJECT_SCHEMA_VERSION
} from '$model/project.model';
export type {
  BeadProject,
  NewProjectOptions
} from '$model/project.model';

export function normalizeProjectName(name: string): string {
  return name.trim().slice(0, MAX_PROJECT_NAME_LENGTH);
}

export function createProject(options: NewProjectOptions): BeadProject {
  const now = new Date().toISOString();
  const width = Math.max(
    MIN_PROJECT_DIMENSION,
    Math.min(MAX_PROJECT_DIMENSION, Math.round(options.width))
  );
  const height = Math.max(
    MIN_PROJECT_DIMENSION,
    Math.min(MAX_PROJECT_DIMENSION, Math.round(options.height))
  );

  return {
    id: crypto.randomUUID(),
    name: normalizeProjectName(options.name) || DEFAULT_PROJECT_NAME,
    gameVersion: options.gameVersion?.trim() || DEFAULT_GAME_VERSION,
    width,
    height,
    beadShape: options.beadShape ?? DEFAULT_BEAD_SHAPE,
    cells: Array.from({ length: width * height }, () => EMPTY_CELL_COLOR_INDEX),
    palette: options.palette ?? createStarterPalette(),
    paletteSource: options.paletteSource ?? {
      ...DEFAULT_PROJECT_PALETTE_SOURCE
    },
    editorState: {
      tool: DEFAULT_EDITOR_TOOL,
      selectionCells: [],
      temporaryLayer: null,
      referenceImages: []
    },
    schemaVersion: PROJECT_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now
  };
}

export function touchProject(project: BeadProject): BeadProject {
  return {
    ...project,
    updatedAt: new Date().toISOString()
  };
}

export function countBeads(project: BeadProject): number {
  return countFilledCells(project.cells);
}

export function countFilledCells(cells: readonly number[]): number {
  return cells.reduce(
    (count, cell) => count + (cell !== EMPTY_CELL_COLOR_INDEX ? 1 : 0),
    0
  );
}

export function countColorUsage(project: BeadProject): number[] {
  const usage = Array.from({ length: project.palette.colors.length + 1 }, () => 0);

  for (const cell of project.cells) {
    if (cell !== EMPTY_CELL_COLOR_INDEX && cell < usage.length) {
      usage[cell] += 1;
    }
  }

  return usage;
}

export interface RequiredArtbeadUsage {
  colorIndex: number;
  id: string;
  hex: string;
  code: string;
  count: number;
}

export function requiredArtbeadUsage(
  project: BeadProject
): RequiredArtbeadUsage[] {
  const usage = countColorUsage(project);

  return project.palette.colors
    .map((color, index) => ({
      colorIndex: index + 1,
      id: color.id,
      hex: color.hex,
      code: color.code,
      count: usage[index + 1] ?? 0
    }))
    .filter((color) => color.count > 0)
    .sort(
      (first, second) =>
        second.count - first.count ||
        first.colorIndex - second.colorIndex
    );
}

export function resizeProject(
  project: BeadProject,
  width: number,
  height: number
): BeadProject {
  const nextWidth = Math.max(
    MIN_PROJECT_DIMENSION,
    Math.min(MAX_PROJECT_DIMENSION, Math.round(width))
  );
  const nextHeight = Math.max(
    MIN_PROJECT_DIMENSION,
    Math.min(MAX_PROJECT_DIMENSION, Math.round(height))
  );
  const cells = Array.from(
    { length: nextWidth * nextHeight },
    () => EMPTY_CELL_COLOR_INDEX
  );

  for (let y = 0; y < Math.min(project.height, nextHeight); y += 1) {
    for (let x = 0; x < Math.min(project.width, nextWidth); x += 1) {
      cells[y * nextWidth + x] =
        project.cells[y * project.width + x] ?? EMPTY_CELL_COLOR_INDEX;
    }
  }

  return touchProject({
    ...project,
    width: nextWidth,
    height: nextHeight,
    cells
  });
}

export function fillProjectRegion(
  project: BeadProject,
  selectionCells: ReadonlySet<number>,
  clickedIndex: number,
  replacementColor: number
): BeadProject {
  if (clickedIndex < 0 || clickedIndex >= project.cells.length) {
    return project;
  }

  const cells = [...project.cells];
  const hasSelection = selectionCells.size > 0;
  const fillSelection = hasSelection && selectionCells.has(clickedIndex);
  let changed = false;

  for (let index = 0; index < cells.length; index += 1) {
    const shouldFill = hasSelection
      ? fillSelection === selectionCells.has(index)
      : true;
    if (shouldFill && cells[index] !== replacementColor) {
      cells[index] = replacementColor;
      changed = true;
    }
  }

  return changed ? touchProject({ ...project, cells }) : project;
}
