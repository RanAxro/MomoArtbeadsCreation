import type {
  CustomPaletteScheme
} from '$model/custom-palette.model';
import { CUSTOM_PALETTE_SCHEMA_VERSION } from '$model/custom-palette.model';
import { getArtbeadsDatabase } from './database';

export const customPaletteRepository = {
  async list(): Promise<CustomPaletteScheme[]> {
    const schemes = await getArtbeadsDatabase()
      .customPaletteSchemes.orderBy('updatedAt')
      .reverse()
      .toArray();
    return schemes;
  },

  async get(id: string): Promise<CustomPaletteScheme | undefined> {
    return getArtbeadsDatabase().customPaletteSchemes.get(id);
  },

  async create(name: string): Promise<CustomPaletteScheme> {
    const now = new Date().toISOString();
    const scheme: CustomPaletteScheme = {
      id: crypto.randomUUID(),
      name,
      colorCodes: [],
      schemaVersion: CUSTOM_PALETTE_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now
    };
    await getArtbeadsDatabase().customPaletteSchemes.put(scheme);
    return scheme;
  },

  async save(scheme: CustomPaletteScheme): Promise<void> {
    await getArtbeadsDatabase().customPaletteSchemes.put({
      ...scheme,
      colorCodes: [...scheme.colorCodes]
    });
  },

  async clear(): Promise<void> {
    await getArtbeadsDatabase().customPaletteSchemes.clear();
  }
};
