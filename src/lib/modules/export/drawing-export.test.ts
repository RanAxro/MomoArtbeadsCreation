import { describe, expect, it } from 'vitest';
import { createProject } from '$domain/project';
import {
  createDrawingExportFilename
} from '$model/drawing-export.model';
import { DEFAULT_VIEW_PREFERENCES } from '$model/view.model';
import { calculateDrawingSheetLayout } from './drawing-export';

describe('drawing export', () => {
  it('keeps the largest supported board within the export board area', () => {
    const project = createProject({
      name: 'Large board',
      width: 300,
      height: 300
    });
    const layout = calculateDrawingSheetLayout(
      project,
      DEFAULT_VIEW_PREFERENCES
    );

    expect(layout.cellSize).toBe(4);
    expect(layout.boardWidth).toBe(1200);
    expect(layout.boardHeight).toBe(1200);
    expect(layout.logicalWidth).toBeGreaterThan(layout.boardWidth);
    expect(layout.logicalHeight).toBeGreaterThan(layout.boardHeight);
  });

  it('removes ruler gutters when the export ruler is disabled', () => {
    const project = createProject({
      name: 'Ruler test',
      width: 40,
      height: 30
    });
    const withRulers = calculateDrawingSheetLayout(
      project,
      DEFAULT_VIEW_PREFERENCES
    );
    const withoutRulers = calculateDrawingSheetLayout(project, {
      ...DEFAULT_VIEW_PREFERENCES,
      showRulers: false
    });

    expect(withoutRulers.logicalWidth).toBe(
      withRulers.logicalWidth - withRulers.rulerSize * 2
    );
    expect(withoutRulers.logicalHeight).toBe(
      withRulers.logicalHeight - withRulers.rulerSize * 2
    );
  });

  it('allocates legend rows for every used color', () => {
    const project = createProject({
      name: 'Legend test',
      width: 8,
      height: 4
    });
    project.palette.colors = Array.from({ length: 30 }, (_, index) => ({
      id: `color-${index}`,
      name: `Color ${index}`,
      code: `T${index + 1}`,
      hex: `#${(index + 1).toString(16).padStart(6, '0')}`
    }));
    project.cells = Array.from({ length: 32 }, (_, index) => index + 1);

    const layout = calculateDrawingSheetLayout(
      project,
      DEFAULT_VIEW_PREFERENCES
    );

    expect(layout.legendColumns).toBe(4);
    expect(layout.legendRows).toBe(8);
  });

  it('creates a safe PNG filename from the scheme name', () => {
    expect(
      createDrawingExportFilename('A/B: draft?. ', '图纸')
    ).toBe('A-B- draft-图纸.png');
    expect(createDrawingExportFilename('   ', 'drawing')).toBe(
      'drawing-drawing.png'
    );
    expect(createDrawingExportFilename('???', 'drawing')).toBe(
      'drawing-drawing.png'
    );
  });
});
