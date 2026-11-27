import { describe, expect, it } from 'vitest';
import {
  CUSTOM_PALETTE_SCHEMA_VERSION,
  customPaletteSchemeSchema
} from './custom-palette.model';

describe('custom palette scheme model', () => {
  const scheme = {
    id: 'palette-1',
    name: '我的调色板',
    colorHexes: ['#4F4745', '#CA966B', '#9D6745'],
    schemaVersion: CUSTOM_PALETTE_SCHEMA_VERSION,
    createdAt: '2026-11-27T12:00:00.000Z',
    updatedAt: '2026-11-27T12:05:00.000Z'
  };

  it('accepts an empty or populated custom palette', () => {
    expect(customPaletteSchemeSchema.safeParse(scheme).success).toBe(true);
    expect(
      customPaletteSchemeSchema.safeParse({
        ...scheme,
        colorHexes: []
      }).success
    ).toBe(true);
  });

  it('rejects duplicate custom palette colors', () => {
    expect(
      customPaletteSchemeSchema.safeParse({
        ...scheme,
        colorHexes: ['#4F4745', '#4f4745']
      }).success
    ).toBe(false);
  });
});
