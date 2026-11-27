import { BeadShape } from '$model/bead-shape.model';

export function fillBeadShape(
  context: CanvasRenderingContext2D,
  shape: BeadShape,
  x: number,
  y: number,
  size: number
): void {
  if (shape === BeadShape.Square) {
    const paintSize = Math.ceil(size + 0.2);
    context.fillRect(x, y, paintSize, paintSize);
    return;
  }

  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const radius = size / 2;

  context.beginPath();
  if (shape === BeadShape.Circle) {
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  } else {
    for (let index = 0; index < 6; index += 1) {
      const angle = (Math.PI / 3) * index;
      const pointX = centerX + Math.cos(angle) * radius;
      const pointY = centerY + Math.sin(angle) * radius;
      if (index === 0) {
        context.moveTo(pointX, pointY);
      } else {
        context.lineTo(pointX, pointY);
      }
    }
    context.closePath();
  }
  context.fill();
}
