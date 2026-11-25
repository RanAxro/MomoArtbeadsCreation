import type { BeadPalette } from './palette.model';

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

export interface CropTransform extends CropCenter {
  scale: number;
}

export interface ImageBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ImageConversionOptions {
  width: number;
  height: number;
  palette: BeadPalette;
  crop?: ImageCrop;
  transparentBelow?: number;
}

export interface ImageConversionResult {
  cells: number[];
  usedColors: number;
  sourceWidth: number;
  sourceHeight: number;
}

export interface ImageCropDragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startCenterX: number;
  startCenterY: number;
}

export interface ImageCropResizeState {
  pointerId: number;
  corner: CropCorner;
  anchorX: number;
  anchorY: number;
  directionX: 1 | -1;
  directionY: 1 | -1;
  minWidth: number;
  maxWidth: number;
}

export enum CropCorner {
  TopLeft = 'top-left',
  TopRight = 'top-right',
  BottomLeft = 'bottom-left',
  BottomRight = 'bottom-right'
}

export enum ImageMimeType {
  Png = 'image/png',
  Jpeg = 'image/jpeg',
  Webp = 'image/webp',
  Gif = 'image/gif'
}

export enum CropArrowKey {
  Left = 'ArrowLeft',
  Right = 'ArrowRight',
  Up = 'ArrowUp',
  Down = 'ArrowDown'
}

export const IMAGE_MIME_TYPES: readonly ImageMimeType[] = [
  ImageMimeType.Png,
  ImageMimeType.Jpeg,
  ImageMimeType.Webp,
  ImageMimeType.Gif
];
export const IMAGE_MIME_PREFIX = 'image/';
export const IMAGE_FILE_PATTERN = /\.(png|jpe?g|webp|gif)$/i;
export const DEFAULT_CROP_CENTER = 0.5;
export const DEFAULT_CROP_SCALE = 1;
export const MIN_CROP_SCALE = 0.05;
export const KEYBOARD_CROP_STEP = 0.01;
export const KEYBOARD_CROP_SHIFT_STEP = 0.05;
export const MIN_CROP_HANDLE_WIDTH = 28;
export const MIN_CROP_HANDLE_SCALE = 0.12;
export const DEFAULT_TRANSPARENT_ALPHA_THRESHOLD = 12;
export const AUTO_PREVIEW_DELAY_MS = 180;
export const RGBA_CHANNEL_COUNT = 4;
export const RGBA_ALPHA_OFFSET = 3;
export const IMAGE_IMPORT_ERRORS = {
  canvasUnavailable: '当前浏览器无法创建图片处理画布。'
} as const;
