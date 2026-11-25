import { describe, expect, it } from 'vitest';
import { createStarterPalette } from '$domain/palette';
import { createProject } from '$domain/project';
import { GameVersion } from '$model/project.model';
import {
  createSelectionClipboard,
  createSelectionLayer,
  mergeSelectionLayer
} from './selection-clipboard';

describe('selection clipboard', () => {
  it('copies an irregular selection into its minimal bounding box', () => {
    const project = createProject({
      name: '复制测试',
      width: 5,
      height: 4,
      gameVersion: GameVersion.V3
    });
    project.cells[6] = 1;
    project.cells[7] = 2;
    project.cells[11] = 3;
    project.cells[12] = 4;

    const clipboard = createSelectionClipboard(
      project,
      new Set([6, 7, 11])
    );

    expect(clipboard?.project.width).toBe(2);
    expect(clipboard?.project.height).toBe(2);
    expect(clipboard?.project.cells).toEqual([1, 2, 3, 4]);
    expect(clipboard?.selectionCells).toEqual([0, 1, 2]);
    expect(clipboard?.project.palette.colors).toHaveLength(
      project.palette.colors.length
    );
  });

  it('pastes a selection around the visible center', () => {
    const source = createProject({
      name: '源方案',
      width: 4,
      height: 3,
      gameVersion: GameVersion.V3
    });
    source.cells[5] = 1;
    source.cells[6] = 2;
    const clipboard = createSelectionClipboard(source, new Set([5, 6]));
    const destination = createProject({
      name: '目标方案',
      width: 8,
      height: 6,
      gameVersion: GameVersion.V3
    });

    const layer = createSelectionLayer(
      clipboard!,
      { x: 4, y: 3 }
    );
    const result = mergeSelectionLayer(
      destination,
      layer!
    );

    expect(layer?.x).toBe(3);
    expect(layer?.y).toBe(3);
    expect(result?.cells[27]).toBe(1);
    expect(result?.cells[28]).toBe(2);
    expect([...(result?.selection ?? [])]).toEqual([27, 28]);
  });

  it('adds a missing source color to the destination palette', () => {
    const sourcePalette = createStarterPalette();
    sourcePalette.colors[0] = {
      ...sourcePalette.colors[0],
      hex: '#123456'
    };
    const source = createProject({
      name: '自定义颜色',
      width: 2,
      height: 2,
      palette: sourcePalette,
      gameVersion: GameVersion.V3
    });
    source.cells[0] = 1;
    const clipboard = createSelectionClipboard(source, new Set([0]));
    const destination = createProject({
      name: '目标方案',
      width: 4,
      height: 4,
      gameVersion: GameVersion.V3
    });
    const originalColorCount = destination.palette.colors.length;

    const layer = createSelectionLayer(
      clipboard!,
      { x: 2, y: 2 }
    );
    const result = mergeSelectionLayer(
      destination,
      layer!
    );

    expect(result?.palette.colors).toHaveLength(originalColorCount + 1);
    expect(result?.palette.colors.at(-1)?.hex).toBe('#123456');
    expect(result?.cells[10]).toBe(originalColorCount + 1);
  });

  it('keeps the pasted layer outside the board until it is merged', () => {
    const source = createProject({
      name: '大选区',
      width: 6,
      height: 2,
      gameVersion: GameVersion.V3
    });
    for (let index = 0; index < 12; index += 1) {
      source.cells[index] = 1;
    }
    const clipboard = createSelectionClipboard(
      source,
      new Set(source.cells.map((_, index) => index))
    );
    const destination = createProject({
      name: '小格板',
      width: 8,
      height: 4,
      gameVersion: GameVersion.V3
    });

    const layer = createSelectionLayer(
      clipboard!,
      { x: 7, y: 3 }
    );
    expect(layer?.x).toBe(4);
    expect(layer?.x! + layer!.width).toBe(10);

    const result = mergeSelectionLayer(destination, layer!);
    expect(result?.selection.size).toBe(8);
    expect(result?.cells[23]).toBe(1);
  });
});
