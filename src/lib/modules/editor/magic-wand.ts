import {
  hexToRgb,
  oklabDistance,
  rgbToOklab,
  type LabColor
} from '$domain/color';
import {
  MAX_MAGIC_WAND_THRESHOLD,
  MIN_MAGIC_WAND_THRESHOLD
} from '$model/selection.model';
import { EMPTY_CELL_COLOR_INDEX } from '$model/project.model';

function normalizedHex(hex: string): string {
  return hex.trim().toLowerCase();
}

function maximumPaletteDistance(colors: readonly LabColor[]): number {
  let maximum = 0;
  for (let first = 0; first < colors.length; first += 1) {
    for (let second = first + 1; second < colors.length; second += 1) {
      maximum = Math.max(
        maximum,
        oklabDistance(colors[first], colors[second])
      );
    }
  }
  return maximum;
}

function addContiguousRegion(
  selection: Set<number>,
  cells: readonly number[],
  width: number,
  height: number,
  cellCount: number,
  startIndex: number,
  matches: (index: number) => boolean
): void {
  const visited = new Uint8Array(cellCount);
  const queue = [startIndex];
  visited[startIndex] = 1;

  while (queue.length > 0) {
    const currentIndex = queue.pop()!;
    selection.add(currentIndex);

    const x = currentIndex % width;
    const y = Math.floor(currentIndex / width);
    const neighbours = [
      x > 0 ? currentIndex - 1 : -1,
      x < width - 1 ? currentIndex + 1 : -1,
      y > 0 ? currentIndex - width : -1,
      y < height - 1 ? currentIndex + width : -1
    ];

    for (const neighbour of neighbours) {
      if (
        neighbour >= 0 &&
        neighbour < cellCount &&
        visited[neighbour] === 0 &&
        matches(neighbour)
      ) {
        visited[neighbour] = 1;
        queue.push(neighbour);
      }
    }
  }
}

export function createMagicWandSelection(
  cells: readonly number[],
  colors: readonly { hex: string }[],
  width: number,
  height: number,
  startIndex: number,
  thresholdPercent: number
): ReadonlySet<number> {
  const selection = new Set<number>();
  const cellCount = Math.max(0, width * height);
  if (
    width <= 0 ||
    height <= 0 ||
    startIndex < 0 ||
    startIndex >= cellCount ||
    startIndex >= cells.length
  ) {
    return selection;
  }

  const startColorIndex = cells[startIndex];
  if (startColorIndex === EMPTY_CELL_COLOR_INDEX) {
    addContiguousRegion(
      selection,
      cells,
      width,
      height,
      cellCount,
      startIndex,
      (index) => cells[index] === EMPTY_CELL_COLOR_INDEX
    );
    return selection;
  }

  const requestedThreshold = Number.isFinite(thresholdPercent)
    ? thresholdPercent
    : MIN_MAGIC_WAND_THRESHOLD;
  const threshold = Math.max(
    MIN_MAGIC_WAND_THRESHOLD,
    Math.min(MAX_MAGIC_WAND_THRESHOLD, requestedThreshold)
  );
  if (threshold >= MAX_MAGIC_WAND_THRESHOLD) {
    for (let index = 0; index < cellCount; index += 1) {
      if (cells[index] !== EMPTY_CELL_COLOR_INDEX) {
        selection.add(index);
      }
    }
    return selection;
  }

  const seedColor = colors[startColorIndex - 1];
  if (!seedColor) {
    return selection;
  }

  const labs = colors.map((color) => rgbToOklab(hexToRgb(color.hex)));
  const seedLab = labs[startColorIndex - 1];
  if (!seedLab) {
    return selection;
  }

  const seedHex = normalizedHex(seedColor.hex);
  const tolerance =
    threshold === MIN_MAGIC_WAND_THRESHOLD
      ? 0
      : maximumPaletteDistance(labs) * (threshold / MAX_MAGIC_WAND_THRESHOLD);

  const matchesColor = (index: number): boolean => {
    const colorIndex = cells[index];
    if (colorIndex === EMPTY_CELL_COLOR_INDEX) {
      return false;
    }

    const candidate = colors[colorIndex - 1];
    if (!candidate) {
      return false;
    }
    if (threshold === MIN_MAGIC_WAND_THRESHOLD) {
      return normalizedHex(candidate.hex) === seedHex;
    }

    const candidateLab = labs[colorIndex - 1];
    return Boolean(
      candidateLab && oklabDistance(seedLab, candidateLab) <= tolerance
    );
  };

  if (!matchesColor(startIndex)) {
    return selection;
  }

  addContiguousRegion(
    selection,
    cells,
    width,
    height,
    cellCount,
    startIndex,
    matchesColor
  );

  return selection;
}
