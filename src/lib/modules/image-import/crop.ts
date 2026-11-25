import {
  DEFAULT_CROP_CENTER,
  MIN_CROP_SCALE,
  type CropCenter,
  type CropTransform,
  type ImageBounds,
  type ImageCrop
} from '$model/image-import.model';

export type {
  CropCenter,
  CropTransform,
  ImageBounds,
  ImageCrop
} from '$model/image-import.model';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateAspectCrop(
  sourceWidth: number,
  sourceHeight: number,
  aspectRatio: number,
  centerX = DEFAULT_CROP_CENTER,
  centerY = DEFAULT_CROP_CENTER,
  scale = 1
): ImageCrop {
  if (sourceWidth <= 0 || sourceHeight <= 0 || aspectRatio <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let maxWidth = sourceWidth;
  let maxHeight = sourceWidth / aspectRatio;

  if (maxHeight > sourceHeight) {
    maxHeight = sourceHeight;
    maxWidth = sourceHeight * aspectRatio;
  }

  const safeScale = clamp(scale, MIN_CROP_SCALE, 1);
  const width = maxWidth * safeScale;
  const height = maxHeight * safeScale;
  const safeCenterX = clamp(centerX, width / sourceWidth / 2, 1 - width / sourceWidth / 2);
  const safeCenterY = clamp(
    centerY,
    height / sourceHeight / 2,
    1 - height / sourceHeight / 2
  );

  return {
    x: safeCenterX * sourceWidth - width / 2,
    y: safeCenterY * sourceHeight - height / 2,
    width,
    height
  };
}

export function cropCenter(crop: ImageCrop, sourceWidth: number, sourceHeight: number): CropCenter {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { x: DEFAULT_CROP_CENTER, y: DEFAULT_CROP_CENTER };
  }

  return {
    x: (crop.x + crop.width / 2) / sourceWidth,
    y: (crop.y + crop.height / 2) / sourceHeight
  };
}

export function fitImageWithinViewport(
  viewportWidth: number,
  viewportHeight: number,
  sourceWidth: number,
  sourceHeight: number
): ImageBounds {
  if (
    viewportWidth <= 0 ||
    viewportHeight <= 0 ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }

  const scale = Math.min(viewportWidth / sourceWidth, viewportHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;

  return {
    left: (viewportWidth - width) / 2,
    top: (viewportHeight - height) / 2,
    width,
    height
  };
}
