import { describe, expect, it } from 'vitest';
import {
  countBeads,
  createProject,
  fillProjectRegion,
  normalizeProjectName,
  resizeProject
} from './project';
import {
  GameVersion,
  MAX_PROJECT_NAME_LENGTH
} from '$model/project.model';

describe('project domain', () => {
  it('creates an empty project with the requested dimensions', () => {
    const project = createProject({
      name: '测试图纸',
      width: 12,
      height: 8,
      gameVersion: GameVersion.V3
    });

    expect(project.cells).toHaveLength(96);
    expect(project.cells.every((cell) => cell === 0)).toBe(true);
    expect(project.gameVersion).toBe(GameVersion.V3);
    expect(project.editorState?.referenceImages).toEqual([]);
  });

  it('normalizes project names and enforces the maximum length', () => {
    expect(normalizeProjectName('  拼绘方案  ')).toBe('拼绘方案');
    expect(normalizeProjectName('名'.repeat(MAX_PROJECT_NAME_LENGTH + 5))).toHaveLength(
      MAX_PROJECT_NAME_LENGTH
    );
  });

  it('fills the whole board when there is no selection', () => {
    const project = createProject({
      name: '填充测试',
      width: 4,
      height: 3,
      gameVersion: GameVersion.V3
    });
    project.cells[1] = 1;
    project.cells[4] = 1;
    project.cells[5] = 1;

    const filled = fillProjectRegion(project, new Set(), 7, 3);

    expect(filled.cells).toEqual(Array.from({ length: 12 }, () => 3));
    expect(countBeads(filled)).toBe(12);
  });

  it('fills only the selection when clicking inside it', () => {
    const project = createProject({
      name: '选区内填充测试',
      width: 4,
      height: 3,
      gameVersion: GameVersion.V3
    });
    project.cells[0] = 1;
    project.cells[5] = 2;
    project.cells[6] = 1;
    project.cells[9] = 2;
    const selection = new Set([5, 6, 9]);

    const filled = fillProjectRegion(project, selection, 6, 4);

    expect(filled.cells).toEqual([
      1, 0, 0, 0,
      0, 4, 4, 0,
      0, 4, 0, 0
    ]);
  });

  it('fills the complement when clicking outside the selection', () => {
    const project = createProject({
      name: '选区外填充测试',
      width: 4,
      height: 3,
      gameVersion: GameVersion.V3
    });
    project.cells[0] = 1;
    project.cells[1] = 2;
    project.cells[5] = 3;
    project.cells[6] = 4;
    const selection = new Set([1, 5, 6]);

    const filled = fillProjectRegion(project, selection, 0, 7);

    expect(filled.cells).toEqual([
      7, 2, 7, 7,
      7, 3, 4, 7,
      7, 7, 7, 7
    ]);
  });

  it('preserves existing cells when resizing a project', () => {
    const project = createProject({
      name: '缩放测试',
      width: 3,
      height: 2,
      gameVersion: GameVersion.V3
    });
    project.cells[4] = 2;

    const resized = resizeProject(project, 5, 3);

    expect(resized.cells).toHaveLength(15);
    expect(resized.cells[6]).toBe(2);
  });
});
