import { createStarterPalette } from './palette';
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
    cells: Array.from({ length: width * height }, () => EMPTY_CELL_COLOR_INDEX),
    palette: options.palette ?? createStarterPalette(),
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
  return project.cells.reduce(
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

export function floodFill(
  project: BeadProject,
  startIndex: number,
  replacementColor: number
): BeadProject {
  if (startIndex < 0 || startIndex >= project.cells.length) {
    return project;
  }

  const targetColor = project.cells[startIndex];
  if (targetColor === replacementColor) {
    return project;
  }

  const cells = [...project.cells];
  const visited = new Uint8Array(cells.length);
  const queue = [startIndex];
  visited[startIndex] = 1;

  while (queue.length > 0) {
    const currentIndex = queue.pop()!;
    if (cells[currentIndex] !== targetColor) {
      continue;
    }

    cells[currentIndex] = replacementColor;
    const x = currentIndex % project.width;
    const y = Math.floor(currentIndex / project.width);
    const neighbours = [
      x > 0 ? currentIndex - 1 : -1,
      x < project.width - 1 ? currentIndex + 1 : -1,
      y > 0 ? currentIndex - project.width : -1,
      y < project.height - 1 ? currentIndex + project.width : -1
    ];

    for (const neighbour of neighbours) {
      if (
        neighbour >= 0 &&
        visited[neighbour] === 0 &&
        cells[neighbour] === targetColor
      ) {
        visited[neighbour] = 1;
        queue.push(neighbour);
      }
    }
  }

  return touchProject({ ...project, cells });
}
