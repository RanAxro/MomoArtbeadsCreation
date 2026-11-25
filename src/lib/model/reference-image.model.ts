import { z } from 'zod';

export const REFERENCE_IMAGE_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const DEFAULT_REFERENCE_IMAGE_COVERAGE = 0.82;
export const MIN_REFERENCE_IMAGE_SIZE = 0.5;
export const MAX_REFERENCE_IMAGE_SIZE = 1000;

export const referenceImageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(260),
  dataUrl: z.string().startsWith('data:image/'),
  width: z.number().finite().positive().max(MAX_REFERENCE_IMAGE_SIZE),
  height: z.number().finite().positive().max(MAX_REFERENCE_IMAGE_SIZE),
  centerX: z.number().finite(),
  centerY: z.number().finite(),
  rotation: z.number().finite()
});

export type ReferenceImage = z.infer<typeof referenceImageSchema>;

export type ReferenceImagePatch = Pick<
  ReferenceImage,
  'centerX' | 'centerY' | 'width' | 'height' | 'rotation'
>;

export function referenceImagesForDrawing(
  references: readonly ReferenceImage[]
): ReferenceImage[] {
  return [...references].reverse();
}

export function reorderReferenceImages(
  references: readonly ReferenceImage[],
  id: string,
  targetIndex: number
): ReferenceImage[] {
  const sourceIndex = references.findIndex((reference) => reference.id === id);
  if (sourceIndex < 0 || references.length === 0) {
    return [...references];
  }

  const nextIndex = Math.max(
    0,
    Math.min(references.length - 1, Math.round(targetIndex))
  );
  if (sourceIndex === nextIndex) {
    return [...references];
  }

  const reordered = [...references];
  const [reference] = reordered.splice(sourceIndex, 1);
  reordered.splice(nextIndex, 0, reference);
  return reordered;
}
