import { describe, expect, it } from 'vitest';
import {
  beadProjectSchema,
  countBeads,
  createProject,
  fillProjectRegion,
  normalizeProjectName,
  requiredArtbeadUsage,
  resizeProject
} from './project';
import {
  GameVersion,
  MAX_PROJECT_NAME_LENGTH,
  PROJECT_SCHEMA_VERSION
} from '$model/project.model';
import {
  BeadShape,
  DEFAULT_BEAD_SHAPE
} from '$model/bead-shape.model';
import { PaletteSourceType } from '$model/palette-source.model';

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
    expect(project.beadShape).toBe(DEFAULT_BEAD_SHAPE);
    expect(project.paletteSource).toEqual({
      type: PaletteSourceType.Complete
    });
    expect(project.schemaVersion).toBe(1);
    expect(project.editorState.referenceImages).toEqual([]);
  });

  it('accepts only the current version-1 project shape', () => {
    const project = createProject({
      name: '严格结构测试',
      width: 2,
      height: 2,
      gameVersion: GameVersion.V3
    });
    const { editorState, ...projectWithoutEditorState } = project;
    const editorStateWithoutReferences = {
      tool: editorState.tool,
      selectionCells: editorState.selectionCells,
      temporaryLayer: editorState.temporaryLayer
    };

    expect(PROJECT_SCHEMA_VERSION).toBe(1);
    expect(beadProjectSchema.safeParse(project).success).toBe(true);
    expect(beadProjectSchema.safeParse(projectWithoutEditorState).success).toBe(
      false
    );
    expect(
      beadProjectSchema.safeParse({
        ...project,
        editorState: editorStateWithoutReferences
      }).success
    ).toBe(false);
    expect(
      beadProjectSchema.safeParse({ ...project, schemaVersion: 3 }).success
    ).toBe(false);
  });

  it('normalizes project names and enforces the maximum length', () => {
    expect(normalizeProjectName('  拼绘方案  ')).toBe('拼绘方案');
    expect(normalizeProjectName('名'.repeat(MAX_PROJECT_NAME_LENGTH + 5))).toHaveLength(
      MAX_PROJECT_NAME_LENGTH
    );
  });

  it('stores a selected Artbead shape and requires the field', () => {
    const project = createProject({
      name: 'shape test',
      width: 2,
      height: 2,
      beadShape: BeadShape.Hexagon
    });
    const { beadShape, ...projectWithoutShape } = project;

    expect(beadShape).toBe(BeadShape.Hexagon);
    expect(project.beadShape).toBe(BeadShape.Hexagon);
    expect(beadProjectSchema.safeParse(projectWithoutShape).success).toBe(
      false
    );
  });

  it('records the complete or a custom palette source per project', () => {
    const completeProject = createProject({
      name: '完整调色盘',
      width: 2,
      height: 2
    });
    const customProject = createProject({
      name: '自定义调色盘',
      width: 2,
      height: 2,
      paletteSource: {
        type: PaletteSourceType.Custom,
        paletteId: 'custom-palette-1'
      }
    });
    const { paletteSource: _paletteSource, ...legacyProject } =
      completeProject;
    const parsedLegacyProject = beadProjectSchema.safeParse(legacyProject);

    expect(completeProject.paletteSource.type).toBe(
      PaletteSourceType.Complete
    );
    expect(customProject.paletteSource).toEqual({
      type: PaletteSourceType.Custom,
      paletteId: 'custom-palette-1'
    });
    expect(parsedLegacyProject.success).toBe(true);
    if (parsedLegacyProject.success) {
      expect(parsedLegacyProject.data.paletteSource).toEqual({
        type: PaletteSourceType.Complete
      });
    }
    expect(
      beadProjectSchema.safeParse({
        ...completeProject,
        paletteSource: { type: 'invalid' }
      }).success
    ).toBe(false);
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

  it('lists only used Artbeads from most to least used', () => {
    const project = createProject({
      name: '用量统计测试',
      width: 4,
      height: 3,
      gameVersion: GameVersion.V3
    });
    project.cells = [
      1, 1, 1, 0,
      2, 2, 2, 2,
      2, 2, 0, 0
    ];

    const required = requiredArtbeadUsage(project);

    expect(required.map((color) => color.colorIndex)).toEqual([2, 1]);
    expect(required.map((color) => color.count)).toEqual([6, 3]);
    expect(required.some((color) => color.colorIndex === 3)).toBe(false);
    expect(required[0].code).toBe(project.palette.colors[1].code);
  });
});
