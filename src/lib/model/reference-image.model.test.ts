import { describe, expect, it } from 'vitest';
import {
  referenceImageSchema,
  referenceImagesForDrawing,
  reorderReferenceImages,
  type ReferenceImage
} from './reference-image.model';

function createReference(
  id: string,
  centerX: number
): ReferenceImage {
  return {
    id,
    name: `${id}.png`,
    dataUrl:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
    width: 4,
    height: 3,
    centerX,
    centerY: 2,
    rotation: 0
  };
}

describe('reference image model', () => {
  it('draws the newest reference last so it masks older images', () => {
    const newest = createReference('newest', 4);
    const older = createReference('older', 2);
    const references = [newest, older];

    expect(
      referenceImagesForDrawing(references).map((reference) => reference.id)
    ).toEqual(['older', 'newest']);
    expect(references.map((reference) => reference.id)).toEqual([
      'newest',
      'older'
    ]);
  });

  it('accepts image data URLs and rejects other URLs', () => {
    expect(referenceImageSchema.safeParse(createReference('image', 1)).success).toBe(
      true
    );
    expect(
      referenceImageSchema.safeParse({
        ...createReference('remote', 1),
        dataUrl: 'https://example.com/image.png'
      }).success
    ).toBe(false);
  });

  it('reorders reference images without mutating the source list', () => {
    const references = [
      createReference('newest', 3),
      createReference('middle', 2),
      createReference('oldest', 1)
    ];

    const reordered = reorderReferenceImages(references, 'oldest', 0);

    expect(reordered.map((reference) => reference.id)).toEqual([
      'oldest',
      'newest',
      'middle'
    ]);
    expect(references.map((reference) => reference.id)).toEqual([
      'newest',
      'middle',
      'oldest'
    ]);
  });
});
