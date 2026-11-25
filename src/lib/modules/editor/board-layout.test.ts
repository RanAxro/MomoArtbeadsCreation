import { describe, expect, it } from 'vitest';
import {
  clampBoardZoom,
  clampViewCenter,
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
    expect(layout.contentX).toBeGreaterThan(0);
    expect(layout.contentY).toBeGreaterThan(0);
    expect(layout.originX).toBeGreaterThanOrEqual(layout.contentX);
    expect(layout.originY).toBeGreaterThanOrEqual(layout.contentY);
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
    expect(
      cellFromCanvasPoint(layout, 24, 18, layout.originX, layout.contentY - 1)
    ).toBeNull();
  });

  it('keeps zoom within the supported range', () => {
    expect(clampBoardZoom(0.1)).toBe(0.5);
    expect(clampBoardZoom(8)).toBe(4);
    expect(clampBoardZoom(1.25)).toBe(1.25);
  });

  it('clamps the viewed area so a zoomed board cannot be panned away', () => {
    const layout = calculateBoardLayout(800, 600, 24, 18);
    const centered = clampViewCenter(layout, 2, {
      x: layout.boardWidth / 2,
      y: layout.boardHeight / 2
    });

    expect(centered.x).toBeCloseTo(layout.boardWidth / 2);
    expect(centered.y).toBeCloseTo(layout.boardHeight / 2);
    expect(
      clampViewCenter(layout, 2, { x: -1000, y: -1000 }).x
    ).toBeGreaterThan(0);
  });

  it('chooses a readable black or white highlight outline', () => {
    expect(contrastingOutline('#FFFFFF')).toBe('#000000');
    expect(contrastingOutline('#000000')).toBe('#FFFFFF');
    expect(contrastingOutline('#C94C68')).toBe('#FFFFFF');
    expect(contrastingOutline('#E7B89B')).toBe('#000000');
  });
});
