export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface LabColor {
  l: number;
  a: number;
  b: number;
}

export const COLOR_CHANNEL_MAX = 255;
export const HEX_RADIX = 16;
export const HEX_CHANNEL_LENGTH = 2;
export const HEX_COLOR_LENGTH = 6;
export const HEX_COLOR_PATTERN = /^[0-9a-f]{6}$/i;
export const HEX_COLOR_VALUE_PATTERN = /^#[0-9a-f]{6}$/i;
export const HEX_PREFIX = '#';
export const BLACK_HEX = '#000000';
export const WHITE_HEX = '#FFFFFF';
export const LUMINANCE_THRESHOLD = 150;
export const RGB_LUMINANCE_WEIGHTS = {
  red: 0.299,
  green: 0.587,
  blue: 0.114
} as const;

export const OKLAB_LINEAR_THRESHOLD = 0.04045;
export const OKLAB_LINEAR_DIVISOR = 12.92;
export const OKLAB_GAMMA_OFFSET = 0.055;
export const OKLAB_GAMMA_DIVISOR = 1.055;
export const OKLAB_GAMMA_EXPONENT = 2.4;

export const OKLAB_LMS_MATRIX = {
  lFromRgb: [0.4122214708, 0.5363325363, 0.0514459929],
  mFromRgb: [0.2119034982, 0.6806995451, 0.1073969566],
  sFromRgb: [0.0883024619, 0.2817188376, 0.6299787005]
} as const;

export const OKLAB_LAB_MATRIX = {
  l: [0.2104542553, 0.793617785, -0.0040720468],
  a: [1.9779984951, -2.428592205, 0.4505937099],
  b: [0.0259040371, 0.7827717662, -0.808675766]
} as const;
