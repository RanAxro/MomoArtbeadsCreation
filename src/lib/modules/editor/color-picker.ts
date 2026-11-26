import type {
  BoardCell,
  BoardLayout
} from '$model/editor.model';
import type { ReferenceImage } from '$model/reference-image.model';

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface ReferencePixel {
  x: number;
  y: number;
}

export function cellCenterPoint(
  layout: BoardLayout,
  cell: BoardCell
): CanvasPoint {
  return {
    x: layout.originX + (cell.x + 0.5) * layout.cellSize,
    y: layout.originY + (cell.y + 0.5) * layout.cellSize
  };
}

export function referencePixelAtPoint(
  reference: ReferenceImage,
  point: CanvasPoint,
  layout: BoardLayout,
  imageWidth: number,
  imageHeight: number
): ReferencePixel | null {
  if (imageWidth <= 0 || imageHeight <= 0) {
    return null;
  }

  const centerX = layout.originX + reference.centerX * layout.cellSize;
  const centerY = layout.originY + reference.centerY * layout.cellSize;
  const angle = (reference.rotation * Math.PI) / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const deltaX = point.x - centerX;
  const deltaY = point.y - centerY;
  const localX = deltaX * cosine + deltaY * sine;
  const localY = -deltaX * sine + deltaY * cosine;
  const renderedWidth = reference.width * layout.cellSize;
  const renderedHeight = reference.height * layout.cellSize;
  const halfWidth = renderedWidth / 2;
  const halfHeight = renderedHeight / 2;

  if (
    renderedWidth <= 0 ||
    renderedHeight <= 0 ||
    localX < -halfWidth ||
    localX > halfWidth ||
    localY < -halfHeight ||
    localY > halfHeight
  ) {
    return null;
  }

  const normalizedX = (localX + halfWidth) / renderedWidth;
  const normalizedY = (localY + halfHeight) / renderedHeight;
  return {
    x: Math.min(
      imageWidth - 1,
      Math.max(0, Math.floor(normalizedX * imageWidth))
    ),
    y: Math.min(
      imageHeight - 1,
      Math.max(0, Math.floor(normalizedY * imageHeight))
    )
  };
}
