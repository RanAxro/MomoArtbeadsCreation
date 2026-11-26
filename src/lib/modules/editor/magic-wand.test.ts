import { describe, expect, it } from 'vitest';
import { createMagicWandSelection } from './magic-wand';

const colors = [
  { hex: '#000000' },
  { hex: '#111111' },
  { hex: '#FFFFFF' }
];

describe('magic wand selection', () => {
  it('selects only the contiguous exact-color region at 0%', () => {
    const cells = [
      1, 1, 2, 1, 1,
      0, 1, 2, 2, 1,
      1, 1, 0, 2, 2
    ];

    const selection = createMagicWandSelection(
      cells,
      colors,
      5,
      3,
      1,
      0
    );

    expect([...selection].sort((first, second) => first - second)).toEqual([
      0, 1, 6, 10, 11
    ]);
  });

  it('includes nearby similar colors without crossing empty cells', () => {
    const cells = [1, 2, 0, 1];
    const selection = createMagicWandSelection(
      cells,
      colors,
      4,
      1,
      0,
      25
    );

    expect([...selection].sort((first, second) => first - second)).toEqual([
      0, 1
    ]);
  });

  it('selects every non-empty Artbead at 100%', () => {
    const cells = [1, 2, 0, 3];
    const selection = createMagicWandSelection(
      cells,
      colors,
      4,
      1,
      0,
      100
    );

    expect([...selection].sort((first, second) => first - second)).toEqual([
      0, 1, 3
    ]);
  });

  it('does not select when the clicked cell is empty', () => {
    const cells = [1, 0, 1];
    const selection = createMagicWandSelection(
      cells,
      colors,
      3,
      1,
      1,
      100
    );

    expect(selection.size).toBe(0);
  });
});
