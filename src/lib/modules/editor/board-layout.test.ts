import { describe, expect, it } from 'vitest';
import {
  calculateBoardLayout,
  cellFromCanvasPoint,
  contrastingOutline
} from './board-layout';

describe('board layout', () => {
  it('centers a square-cell board inside the ruler gutters', () => {
    const layout = calculateBoardLayout(800, 600, 24, 18);

    expect(layout.boardWidth).toBeCloseTo(24 * layout.cellSize);
    expect(layout.boardHeight).toBeCloseTo(18 * layout.cellSize);
    expect(layout.originX + layout.boardWidth / 2).toBeCloseTo(400);
    expect(layout.originY + layout.boardHeight / 2).toBeCloseTo(300);
  });

  it('maps the sixth column and fourth row to one-based ruler indexes', () => {
    const layout = calculateBoardLayout(800, 600, 24, 18);
    const cell = cellFromCanvasPoint(
      layout,
      24,
      18,
      layout.originX + (6 - 0.5) * layout.cellSize,
      layout.originY + (4 - 0.5) * layout.cellSize
    );

    expect(cell).toEqual({
      x: 5,
      y: 3,
      index: 3 * 24 + 5
    });
  });

  it('ignores points outside the board', () => {
    const layout = calculateBoardLayout(800, 600, 24, 18);

    expect(cellFromCanvasPoint(layout, 24, 18, 0, 0)).toBeNull();
  });

  it('chooses a readable black or white highlight outline', () => {
    expect(contrastingOutline('#FFFFFF')).toBe('#000000');
    expect(contrastingOutline('#000000')).toBe('#FFFFFF');
    expect(contrastingOutline('#C94C68')).toBe('#FFFFFF');
    expect(contrastingOutline('#E7B89B')).toBe('#000000');
  });
});
