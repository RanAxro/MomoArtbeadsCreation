export interface ImageCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropCenter {
  x: number;
  y: number;
}

export interface ImageBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateAspectCrop(
  sourceWidth: number,
  sourceHeight: number,
  aspectRatio: number,
  centerX = 0.5,
  centerY = 0.5
): ImageCrop {
  if (sourceWidth <= 0 || sourceHeight <= 0 || aspectRatio <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let width = sourceWidth;
  let height = sourceWidth / aspectRatio;

  if (height > sourceHeight) {
    height = sourceHeight;
    width = sourceHeight * aspectRatio;
  }

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
    return { x: 0.5, y: 0.5 };
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
