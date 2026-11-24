import { describe, expect, it } from 'vitest';
import { countBeads, createProject, floodFill, resizeProject } from './project';

describe('project domain', () => {
  it('creates an empty project with the requested dimensions', () => {
    const project = createProject({ name: '测试图纸', width: 12, height: 8, gameVersion: '3.0' });

    expect(project.cells).toHaveLength(96);
    expect(project.cells.every((cell) => cell === 0)).toBe(true);
    expect(project.gameVersion).toBe('3.0');
  });

  it('flood fills connected cells without crossing grid edges', () => {
    const project = createProject({
      name: '填充测试',
      width: 4,
      height: 3,
      gameVersion: '3.0'
    });
    project.cells[1] = 1;
    project.cells[4] = 1;
    project.cells[5] = 1;

    const filled = floodFill(project, 2, 3);

    expect(filled.cells).toEqual([0, 1, 3, 3, 1, 1, 3, 3, 3, 3, 3, 3]);
    expect(countBeads(filled)).toBe(11);
  });

  it('preserves existing cells when resizing a project', () => {
    const project = createProject({ name: '缩放测试', width: 3, height: 2, gameVersion: '3.0' });
    project.cells[4] = 2;

    const resized = resizeProject(project, 5, 3);

    expect(resized.cells).toHaveLength(15);
    expect(resized.cells[6]).toBe(2);
  });
});
