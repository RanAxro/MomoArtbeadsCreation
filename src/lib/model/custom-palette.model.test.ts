import { describe, expect, it } from 'vitest';
import {
  CUSTOM_PALETTE_SCHEMA_VERSION,
  customPaletteSchemeSchema
} from './custom-palette.model';

describe('custom palette scheme model', () => {
  const scheme = {
    id: 'palette-1',
    name: '我的调色板',
    colorCodes: ['1', 'A11', 'A28'],
    schemaVersion: CUSTOM_PALETTE_SCHEMA_VERSION,
    createdAt: '2026-11-27T12:00:00.000Z',
    updatedAt: '2026-11-27T12:05:00.000Z'
  };

  it('accepts an empty or populated custom palette', () => {
    expect(customPaletteSchemeSchema.safeParse(scheme).success).toBe(true);
    expect(
      customPaletteSchemeSchema.safeParse({
        ...scheme,
        colorCodes: []
      }).success
    ).toBe(true);
  });

  it('rejects duplicate custom palette colors', () => {
    expect(
      customPaletteSchemeSchema.safeParse({
        ...scheme,
        colorCodes: ['1', '1']
      }).success
    ).toBe(false);
  });
});
