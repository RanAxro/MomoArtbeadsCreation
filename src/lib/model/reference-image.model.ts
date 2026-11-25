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
