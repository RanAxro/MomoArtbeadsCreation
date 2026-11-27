export enum BeadShape {
  Square = 'square',
  Circle = 'circle',
  Hexagon = 'hexagon'
}

export enum BeadShapeLabelKey {
  Square = 'beadShape.square',
  Circle = 'beadShape.circle',
  Hexagon = 'beadShape.hexagon'
}

export interface BeadShapeOption {
  value: BeadShape;
  labelKey: BeadShapeLabelKey;
}

export const DEFAULT_BEAD_SHAPE = BeadShape.Square;

export const BEAD_SHAPE_OPTIONS: readonly BeadShapeOption[] = [
  {
    value: BeadShape.Square,
    labelKey: BeadShapeLabelKey.Square
  },
  {
    value: BeadShape.Circle,
    labelKey: BeadShapeLabelKey.Circle
  },
  {
    value: BeadShape.Hexagon,
    labelKey: BeadShapeLabelKey.Hexagon
  }
];

export function isBeadShape(value: unknown): value is BeadShape {
  return BEAD_SHAPE_OPTIONS.some((option) => option.value === value);
}

export function beadShapeLabelKey(shape: BeadShape): BeadShapeLabelKey {
  return (
    BEAD_SHAPE_OPTIONS.find((option) => option.value === shape)?.labelKey ??
    BeadShapeLabelKey.Square
  );
}
