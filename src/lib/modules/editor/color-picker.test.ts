import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BOARD_LAYOUT
} from '$model/editor.model';
import type { BoardLayout } from '$model/editor.model';
import type { ReferenceImage } from '$model/reference-image.model';
import {
  cellCenterPoint,
  referencePixelAtPoint
} from './color-picker';

const layout: BoardLayout = {
  ...DEFAULT_BOARD_LAYOUT,
  originX: 100,
  originY: 50,
  cellSize: 10
};

function reference(
  overrides: Partial<ReferenceImage> = {}
): ReferenceImage {
  return {
    id: 'reference',
    name: 'Reference',
    dataUrl: 'data:image/png;base64,',
    width: 8,
    height: 4,
    centerX: 2,
    centerY: 2,
    rotation: 0,
    ...overrides
  };
}

describe('color picker sampling', () => {
  it('uses the selected grid cell center as the sampling point', () => {
    expect(cellCenterPoint(layout, { x: 2, y: 3, index: 74 })).toEqual({
      x: 125,
      y: 85
    });
  });

  it('maps the reference image center to its source center pixel', () => {
    expect(
      referencePixelAtPoint(
        reference(),
        { x: 120, y: 70 },
        layout,
        8,
        4
      )
    ).toEqual({ x: 4, y: 2 });
  });

  it('maps a point through the reference image rotation', () => {
    expect(
      referencePixelAtPoint(
        reference({ rotation: 90 }),
        { x: 120, y: 90 },
        layout,
        8,
        4
      )
    ).toEqual({ x: 6, y: 2 });
  });

  it('ignores points outside the rendered reference image', () => {
    expect(
      referencePixelAtPoint(
        reference(),
        { x: 70, y: 70 },
        layout,
        8,
        4
      )
    ).toBeNull();
  });
});
