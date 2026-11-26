import { describe, expect, it } from 'vitest';
import {
  combineSelections,
  createSelectionRectangle,
  eraseSelectedCells,
  getSameColorSelection
} from './selection';
import { SelectionOperation } from '$model/selection.model';

describe('rectangular selection', () => {
  it('creates an inclusive normalized rectangle', () => {
    const selection = createSelectionRectangle(
      { x: 3, y: 2, index: 13 },
      { x: 1, y: 1, index: 6 },
      5,
      4,
      false
    );

    expect(selection.width).toBe(3);
    expect(selection.height).toBe(2);
    expect([...selection.cells]).toEqual([6, 7, 8, 11, 12, 13]);
  });

  it('locks a selection to a square in grid cells', () => {
    const selection = createSelectionRectangle(
      { x: 1, y: 1, index: 6 },
      { x: 4, y: 2, index: 12 },
      6,
      5,
      true
    );

    expect(selection.width).toBe(4);
    expect(selection.height).toBe(4);
    expect(selection.end).toEqual({ x: 4, y: 4, index: 28 });
  });

  it('keeps a square selection inside the pegboard', () => {
    const selection = createSelectionRectangle(
      { x: 3, y: 3, index: 15 },
      { x: 0, y: 1, index: 4 },
      4,
      4,
      true
    );

    expect(selection.width).toBe(4);
    expect(selection.height).toBe(4);
    expect(selection.minX).toBe(0);
    expect(selection.minY).toBe(0);
  });

  it('combines selections with replace and set operations', () => {
    const previous = new Set([1, 2, 3]);
    const rectangle = new Set([3, 4]);

    expect([
      ...combineSelections(previous, rectangle, SelectionOperation.Replace)
    ]).toEqual([3, 4]);
    expect([
      ...combineSelections(previous, rectangle, SelectionOperation.Union)
    ]).toEqual([1, 2, 3, 4]);
    expect([
      ...combineSelections(previous, rectangle, SelectionOperation.Subtract)
    ]).toEqual([1, 2]);
    expect([
      ...combineSelections(previous, rectangle, SelectionOperation.Xor)
    ]).toEqual([1, 2, 4]);
    expect([
      ...combineSelections(previous, rectangle, SelectionOperation.Intersect)
    ]).toEqual([3]);
  });
});

describe('same-color selection', () => {
  it('selects every cell whose palette color matches the clicked bead', () => {
    const cells = [1, 2, 1, 3, 0, 2];
    const colors = [
      { hex: '#111111' },
      { hex: '#111111' },
      { hex: '#222222' }
    ];

    expect([
      ...getSameColorSelection(cells, colors, cells[1])
    ]).toEqual([0, 1, 2, 5]);
  });

  it('selects every empty cell when an empty cell is clicked', () => {
    const cells = [1, 0, 1, 0, 0];
    const colors = [{ hex: '#111111' }];

    expect([...getSameColorSelection(cells, colors, 0)]).toEqual([1, 3, 4]);
  });

  it('returns no matches for an invalid color index', () => {
    const cells = [1, 0, 1];
    const colors = [{ hex: '#111111' }];

    expect([...getSameColorSelection(cells, colors, 2)]).toEqual([]);
  });
});

describe('selection deletion', () => {
  it('clears only the selected non-empty cells', () => {
    const result = eraseSelectedCells(
      [1, 2, 0, 3],
      new Set([0, 2, 3])
    );

    expect(result.cells).toEqual([0, 2, 0, 0]);
    expect(result.changed).toBe(true);
  });

  it('reports no change when the selected cells are already empty', () => {
    const result = eraseSelectedCells([1, 0, 1], new Set([1]));

    expect(result.changed).toBe(false);
  });
});
