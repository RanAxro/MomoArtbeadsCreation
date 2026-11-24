import {
  createColorIndex,
  nearestPaletteIndex,
  type BeadPalette
} from '$domain/palette';

export interface ImageConversionOptions {
  width: number;
  height: number;
  palette: BeadPalette;
  transparentBelow?: number;
}

export interface ImageConversionResult {
  cells: number[];
  usedColors: number;
  sourceWidth: number;
  sourceHeight: number;
}

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
    throw new Error('当前浏览器无法创建图片处理画布。');
  }

  context.clearRect(0, 0, options.width, options.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, options.width, options.height);

  const pixels = context.getImageData(0, 0, options.width, options.height).data;
  const colorIndex = createColorIndex(options.palette);
  const cells = new Array<number>(options.width * options.height);
  const used = new Set<number>();
  const transparentBelow = options.transparentBelow ?? 12;

  for (let index = 0; index < cells.length; index += 1) {
    const offset = index * 4;
    const alpha = pixels[offset + 3];

    if (alpha < transparentBelow) {
      cells[index] = 0;
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
