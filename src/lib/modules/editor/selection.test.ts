import { describe, expect, it } from 'vitest';
import {
  combineSelections,
  createSelectionRectangle
} from './selection';

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

    expect([...combineSelections(previous, rectangle, 'replace')]).toEqual([3, 4]);
    expect([...combineSelections(previous, rectangle, 'union')]).toEqual([1, 2, 3, 4]);
    expect([...combineSelections(previous, rectangle, 'subtract')]).toEqual([1, 2]);
    expect([...combineSelections(previous, rectangle, 'xor')]).toEqual([1, 2, 4]);
    expect([...combineSelections(previous, rectangle, 'intersect')]).toEqual([3]);
  });
});
