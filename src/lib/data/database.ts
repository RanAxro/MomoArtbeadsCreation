import Dexie, { type Table } from 'dexie';
import {
  CUSTOM_PALETTE_TABLE_INDEXES,
  CUSTOM_PALETTE_TABLE_NAME,
  PROJECT_DATABASE_NAME,
  PROJECT_DATABASE_VERSION,
  PROJECT_TABLE_INDEXES,
  PROJECT_TABLE_NAME,
  SELECTION_CLIPBOARD_TABLE_INDEXES,
  SELECTION_CLIPBOARD_TABLE_NAME
} from '$model/data.model';
import type { CustomPaletteScheme } from '$model/custom-palette.model';
import type { BeadProject } from '$model/project.model';
import type { SelectionClipboard } from '$model/selection-clipboard.model';

class MomoArtbeadsDatabase extends Dexie {
  projects!: Table<BeadProject, string>;
  selectionClipboard!: Table<SelectionClipboard, string>;
  customPaletteSchemes!: Table<CustomPaletteScheme, string>;

  constructor() {
    super(PROJECT_DATABASE_NAME);
    this.version(PROJECT_DATABASE_VERSION).stores({
      [PROJECT_TABLE_NAME]: PROJECT_TABLE_INDEXES,
      [SELECTION_CLIPBOARD_TABLE_NAME]: SELECTION_CLIPBOARD_TABLE_INDEXES,
      [CUSTOM_PALETTE_TABLE_NAME]: CUSTOM_PALETTE_TABLE_INDEXES
    });
  }
}

let database: MomoArtbeadsDatabase | null = null;

export function getArtbeadsDatabase(): MomoArtbeadsDatabase {
  if (!database) {
    database = new MomoArtbeadsDatabase();
  }
  return database;
}
