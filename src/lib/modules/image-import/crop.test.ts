import { describe, expect, it } from 'vitest';
import {
  calculateAspectCrop,
  cropCenter,
  fitImageWithinViewport
} from './crop';

describe('image crop geometry', () => {
  it('centers a 4:3 crop inside a 16:9 image', () => {
    const crop = calculateAspectCrop(1600, 900, 4 / 3);

    expect(crop).toEqual({
      x: 200,
      y: 0,
      width: 1200,
      height: 900
    });
  });

  it('keeps the crop inside the image when its center is moved', () => {
    const crop = calculateAspectCrop(1600, 900, 4 / 3, 0, 1);

    expect(crop.x).toBe(0);
    expect(crop.x + crop.width).toBe(1200);
    expect(cropCenter(crop, 1600, 900).x).toBe(0.375);
  });

  it('scales the crop while preserving the target aspect ratio', () => {
    const crop = calculateAspectCrop(1600, 900, 4 / 3, 0.5, 0.5, 0.5);

    expect(crop).toEqual({
      x: 500,
      y: 225,
      width: 600,
      height: 450
    });
  });

  it('fits the source image inside the crop stage while preserving its ratio', () => {
    expect(fitImageWithinViewport(600, 400, 1600, 900)).toEqual({
      left: 0,
      top: 31.25,
      width: 600,
      height: 337.5
    });
  });
});
