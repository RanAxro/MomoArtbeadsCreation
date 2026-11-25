import {
  createColorIndex,
  nearestPaletteIndex
} from '$domain/palette';
import {
  DEFAULT_TRANSPARENT_ALPHA_THRESHOLD,
  IMAGE_IMPORT_ERRORS,
  RGBA_ALPHA_OFFSET,
  RGBA_CHANNEL_COUNT,
  type ImageConversionOptions,
  type ImageConversionResult
} from '$model/image-import.model';
import { EMPTY_CELL_COLOR_INDEX } from '$model/project.model';

export type {
  ImageConversionOptions,
  ImageConversionResult
} from '$model/image-import.model';

export async function convertImageToPattern(
  file: File,
  options: ImageConversionOptions
): Promise<ImageConversionResult> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = options.width;
  canvas.height = options.height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error(IMAGE_IMPORT_ERRORS.canvasUnavailable);
  }

  context.clearRect(0, 0, options.width, options.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  const cropX = Math.max(0, Math.min(bitmap.width - 1, options.crop?.x ?? 0));
  const cropY = Math.max(0, Math.min(bitmap.height - 1, options.crop?.y ?? 0));
  const cropWidth = Math.max(
    1,
    Math.min(bitmap.width - cropX, options.crop?.width ?? bitmap.width)
  );
  const cropHeight = Math.max(
    1,
    Math.min(bitmap.height - cropY, options.crop?.height ?? bitmap.height)
  );
  context.drawImage(
    bitmap,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    options.width,
    options.height
  );

  const pixels = context.getImageData(0, 0, options.width, options.height).data;
  const colorIndex = createColorIndex(options.palette);
  const cells = new Array<number>(options.width * options.height);
  const used = new Set<number>();
  const transparentBelow =
    options.transparentBelow ?? DEFAULT_TRANSPARENT_ALPHA_THRESHOLD;

  for (let index = 0; index < cells.length; index += 1) {
    const offset = index * RGBA_CHANNEL_COUNT;
    const alpha = pixels[offset + RGBA_ALPHA_OFFSET];

    if (alpha < transparentBelow) {
      cells[index] = EMPTY_CELL_COLOR_INDEX;
      continue;
    }

    const paletteIndex = nearestPaletteIndex(colorIndex, {
      r: pixels[offset],
      g: pixels[offset + 1],
      b: pixels[offset + 2]
    });
    cells[index] = paletteIndex;
    used.add(paletteIndex);
  }

  const result: ImageConversionResult = {
    cells,
    usedColors: used.size,
    sourceWidth: bitmap.width,
    sourceHeight: bitmap.height
  };

  bitmap.close();
  return result;
}

export async function readImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dimensions;
}
