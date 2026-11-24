import { z } from 'zod';
import { createStarterPalette, type BeadPalette } from './palette';

export const PROJECT_SCHEMA_VERSION = 1;
export const MAX_PROJECT_DIMENSION = 300;
export const MAX_PROJECT_NAME_LENGTH = 80;

const beadColorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  hex: z.string().regex(/^#[0-9a-f]{6}$/i),
  code: z.string(),
  stock: z.number().int().nonnegative().optional()
});

const paletteSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  colors: z.array(beadColorSchema).min(1).max(128)
});

export const beadProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(MAX_PROJECT_NAME_LENGTH),
  gameVersion: z.string().min(1).max(30),
  width: z.number().int().min(1).max(MAX_PROJECT_DIMENSION),
  height: z.number().int().min(1).max(MAX_PROJECT_DIMENSION),
  cells: z.array(z.number().int().nonnegative()),
  palette: paletteSchema,
  schemaVersion: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type BeadProject = z.infer<typeof beadProjectSchema>;
export type BeadColor = BeadPalette['colors'][number];

export interface NewProjectOptions {
  name: string;
  width: number;
  height: number;
  palette?: BeadPalette;
  gameVersion?: string;
}

export function normalizeProjectName(name: string): string {
  return name.trim().slice(0, MAX_PROJECT_NAME_LENGTH);
}

export function createProject(options: NewProjectOptions): BeadProject {
  const now = new Date().toISOString();
  const width = Math.max(1, Math.min(MAX_PROJECT_DIMENSION, Math.round(options.width)));
  const height = Math.max(1, Math.min(MAX_PROJECT_DIMENSION, Math.round(options.height)));

  return {
    id: crypto.randomUUID(),
    name: normalizeProjectName(options.name) || '未命名拼绘方案',
    gameVersion: options.gameVersion?.trim() || '3.0',
    width,
    height,
    cells: Array.from({ length: width * height }, () => 0),
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
  return project.cells.reduce((count, cell) => count + (cell > 0 ? 1 : 0), 0);
}

export function countColorUsage(project: BeadProject): number[] {
  const usage = Array.from({ length: project.palette.colors.length + 1 }, () => 0);

  for (const cell of project.cells) {
    if (cell > 0 && cell < usage.length) {
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
  const nextWidth = Math.max(1, Math.min(MAX_PROJECT_DIMENSION, Math.round(width)));
  const nextHeight = Math.max(1, Math.min(MAX_PROJECT_DIMENSION, Math.round(height)));
  const cells = Array.from({ length: nextWidth * nextHeight }, () => 0);

  for (let y = 0; y < Math.min(project.height, nextHeight); y += 1) {
    for (let x = 0; x < Math.min(project.width, nextWidth); x += 1) {
      cells[y * nextWidth + x] = project.cells[y * project.width + x] ?? 0;
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
