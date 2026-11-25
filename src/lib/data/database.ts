import Dexie, { type Table } from 'dexie';
import {
  PROJECT_DATABASE_NAME,
  PROJECT_DATABASE_VERSION,
  PROJECT_TABLE_INDEXES,
  PROJECT_TABLE_NAME,
  SELECTION_CLIPBOARD_TABLE_INDEXES,
  SELECTION_CLIPBOARD_TABLE_NAME
} from '$model/data.model';
import type { BeadProject } from '$model/project.model';
import type { SelectionClipboard } from '$model/selection-clipboard.model';

class MomoArtbeadsDatabase extends Dexie {
  projects!: Table<BeadProject, string>;
  selectionClipboard!: Table<SelectionClipboard, string>;

  constructor() {
    super(PROJECT_DATABASE_NAME);
    this.version(1).stores({
      [PROJECT_TABLE_NAME]: PROJECT_TABLE_INDEXES
    });
    this.version(PROJECT_DATABASE_VERSION).stores({
      [SELECTION_CLIPBOARD_TABLE_NAME]: SELECTION_CLIPBOARD_TABLE_INDEXES
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
