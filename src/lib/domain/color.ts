import {
  COLOR_CHANNEL_MAX,
  HEX_CHANNEL_LENGTH,
  HEX_COLOR_LENGTH,
  HEX_COLOR_PATTERN,
  HEX_PREFIX,
  HEX_RADIX,
  OKLAB_GAMMA_DIVISOR,
  OKLAB_GAMMA_EXPONENT,
  OKLAB_GAMMA_OFFSET,
  OKLAB_LAB_MATRIX,
  OKLAB_LINEAR_DIVISOR,
  OKLAB_LINEAR_THRESHOLD,
  OKLAB_LMS_MATRIX,
  type LabColor,
  type RgbColor
} from '$model/color.model';

export type { LabColor, RgbColor } from '$model/color.model';

export function isHexColor(hex: string): boolean {
  const normalized = hex.replace(HEX_PREFIX, '').trim();
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((part) => `${part}${part}`)
          .join('')
      : normalized;

  return HEX_COLOR_PATTERN.test(expanded);
}

export function hexToRgb(hex: string): RgbColor {
  const normalized = hex.replace(HEX_PREFIX, '').trim();
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((part) => `${part}${part}`)
          .join('')
      : normalized;

  if (
    value.length !== HEX_COLOR_LENGTH ||
    !HEX_COLOR_PATTERN.test(value)
  ) {
    return { r: 0, g: 0, b: 0 };
  }

  return {
    r: Number.parseInt(value.slice(0, HEX_CHANNEL_LENGTH), HEX_RADIX),
    g: Number.parseInt(
      value.slice(HEX_CHANNEL_LENGTH, HEX_CHANNEL_LENGTH * 2),
      HEX_RADIX
    ),
    b: Number.parseInt(
      value.slice(HEX_CHANNEL_LENGTH * 2, HEX_CHANNEL_LENGTH * 3),
      HEX_RADIX
    )
  };
}

export function rgbToHex({ r, g, b }: RgbColor): string {
  const component = (value: number) =>
    Math.max(0, Math.min(COLOR_CHANNEL_MAX, Math.round(value)))
      .toString(HEX_RADIX)
      .padStart(HEX_CHANNEL_LENGTH, '0');

  return `${HEX_PREFIX}${component(r)}${component(g)}${component(b)}`.toUpperCase();
}

function linearize(channel: number): number {
  const value = channel / COLOR_CHANNEL_MAX;
  return value <= OKLAB_LINEAR_THRESHOLD
    ? value / OKLAB_LINEAR_DIVISOR
    : ((value + OKLAB_GAMMA_OFFSET) / OKLAB_GAMMA_DIVISOR) **
        OKLAB_GAMMA_EXPONENT;
}

export function rgbToOklab(color: RgbColor): LabColor {
  const r = linearize(color.r);
  const g = linearize(color.g);
  const b = linearize(color.b);

  const l =
    OKLAB_LMS_MATRIX.lFromRgb[0] * r +
    OKLAB_LMS_MATRIX.lFromRgb[1] * g +
    OKLAB_LMS_MATRIX.lFromRgb[2] * b;
  const m =
    OKLAB_LMS_MATRIX.mFromRgb[0] * r +
    OKLAB_LMS_MATRIX.mFromRgb[1] * g +
    OKLAB_LMS_MATRIX.mFromRgb[2] * b;
  const s =
    OKLAB_LMS_MATRIX.sFromRgb[0] * r +
    OKLAB_LMS_MATRIX.sFromRgb[1] * g +
    OKLAB_LMS_MATRIX.sFromRgb[2] * b;

  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  return {
    l:
      OKLAB_LAB_MATRIX.l[0] * lRoot +
      OKLAB_LAB_MATRIX.l[1] * mRoot +
      OKLAB_LAB_MATRIX.l[2] * sRoot,
    a:
      OKLAB_LAB_MATRIX.a[0] * lRoot +
      OKLAB_LAB_MATRIX.a[1] * mRoot +
      OKLAB_LAB_MATRIX.a[2] * sRoot,
    b:
      OKLAB_LAB_MATRIX.b[0] * lRoot +
      OKLAB_LAB_MATRIX.b[1] * mRoot +
      OKLAB_LAB_MATRIX.b[2] * sRoot
  };
}

export function oklabDistance(first: LabColor, second: LabColor): number {
  const lightness = first.l - second.l;
  const redGreen = first.a - second.a;
  const blueYellow = first.b - second.b;

  return lightness * lightness + redGreen * redGreen + blueYellow * blueYellow;
}
