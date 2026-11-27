import { describe, expect, it } from 'vitest';
import { createProject } from '$domain/project';
import {
  artbeadDisplayCode,
  createDrawingExportFilename,
  DEFAULT_DRAWING_EXPORT_SETTINGS
} from '$model/drawing-export.model';
import {
  calculateDrawingSheetLayout,
  calculateRulerFontSize
} from './drawing-export';

describe('drawing export', () => {
  it('keeps the largest supported board within the export board area', () => {
    const project = createProject({
      name: 'Large board',
      width: 300,
      height: 300
    });
    const layout = calculateDrawingSheetLayout(
      project,
      DEFAULT_DRAWING_EXPORT_SETTINGS
    );

    expect(layout.cellSize).toBe(3);
    expect(layout.boardWidth).toBe(900);
    expect(layout.boardHeight).toBe(900);
    expect(layout.logicalWidth * 3).toBe(layout.logicalHeight * 4);
  });

  it('removes ruler gutters when the export ruler is disabled', () => {
    const project = createProject({
      name: 'Ruler test',
      width: 40,
      height: 30
    });
    const withRulers = calculateDrawingSheetLayout(
      project,
      DEFAULT_DRAWING_EXPORT_SETTINGS
    );
    const withoutRulers = calculateDrawingSheetLayout(project, {
      ...DEFAULT_DRAWING_EXPORT_SETTINGS,
      showRulers: false
    });

    expect(withoutRulers.logicalWidth).toBeGreaterThan(
      withRulers.logicalWidth
    );
    expect(withoutRulers.logicalHeight).toBeGreaterThan(
      withRulers.logicalHeight
    );
    expect(withoutRulers.cellSize).toBeGreaterThan(withRulers.cellSize);
    expect(withoutRulers.boardWidth).toBeGreaterThan(withRulers.boardWidth);
    expect(withoutRulers.logicalWidth * 3).toBe(
      withoutRulers.logicalHeight * 4
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
      DEFAULT_DRAWING_EXPORT_SETTINGS
    );

    expect(layout.legendColumns).toBe(4);
    expect(layout.legendRows).toBe(8);
    expect(layout.logicalWidth * 3).toBe(layout.logicalHeight * 4);
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

  it('uses the hex value when an Artbead has no code', () => {
    expect(artbeadDisplayCode('A13', '#aabbcc')).toBe('A13');
    expect(artbeadDisplayCode('   ', '#aabbcc')).toBe('#AABBCC');
  });

  it('shrinks ruler text to fit every label', () => {
    expect(calculateRulerFontSize(24, 18, 48)).toBe(13.5);
    expect(calculateRulerFontSize(84, 63, 13)).toBeLessThan(13.5);
    expect(calculateRulerFontSize(300, 300, 3)).toBeCloseTo(1.6129, 3);
  });

  it('derives the sheet width from the board width', () => {
    const small = calculateDrawingSheetLayout(
      createProject({ name: 'Small', width: 24, height: 18 }),
      DEFAULT_DRAWING_EXPORT_SETTINGS
    );
    const large = calculateDrawingSheetLayout(
      createProject({ name: 'Large', width: 84, height: 63 }),
      DEFAULT_DRAWING_EXPORT_SETTINGS
    );

    expect(large.logicalWidth).toBeGreaterThan(small.logicalWidth);
    expect(large.logicalWidth * 3).toBe(large.logicalHeight * 4);
    expect(DEFAULT_DRAWING_EXPORT_SETTINGS.showArtbeadCodes).toBe(true);
  });
});
