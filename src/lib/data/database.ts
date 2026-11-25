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

interface LegacySelectionClipboard {
  project?: {
    width: number;
    height: number;
    cells: number[];
    palette: SelectionClipboard['board']['palette'];
  };
}

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
    }).upgrade(async (transaction) => {
      await transaction
        .table<SelectionClipboard | LegacySelectionClipboard>(
          SELECTION_CLIPBOARD_TABLE_NAME
        )
        .toCollection()
        .modify((entry) => {
          const record = entry as SelectionClipboard & LegacySelectionClipboard;
          if (!record.board && record.project) {
            record.board = {
              width: record.project.width,
              height: record.project.height,
              cells: [...record.project.cells],
              palette: {
                ...record.project.palette,
                colors: record.project.palette.colors.map((color) => ({
                  ...color
                }))
              }
            };
          }
          delete record.project;
        });
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
