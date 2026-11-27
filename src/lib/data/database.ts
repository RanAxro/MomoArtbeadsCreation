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
import { CUSTOM_PALETTE_SCHEMA_VERSION } from '$model/custom-palette.model';
import type { BeadProject } from '$model/project.model';
import type { SelectionClipboard } from '$model/selection-clipboard.model';
import { artbeadHexForCode } from '$domain/palette';

const DATABASE_SCHEMA = {
  [PROJECT_TABLE_NAME]: PROJECT_TABLE_INDEXES,
  [SELECTION_CLIPBOARD_TABLE_NAME]: SELECTION_CLIPBOARD_TABLE_INDEXES,
  [CUSTOM_PALETTE_TABLE_NAME]: CUSTOM_PALETTE_TABLE_INDEXES
};

interface StoredPaletteColor {
  code?: unknown;
  [key: string]: unknown;
}

interface StoredPalette {
  colors: StoredPaletteColor[];
}

interface StoredProjectWithCodes {
  palette?: StoredPalette;
  editorState?: {
    temporaryLayer?: {
      palette?: StoredPalette;
    } | null;
  };
}

interface StoredClipboardWithCodes {
  board?: {
    palette?: StoredPalette;
  };
}

interface StoredCustomPaletteWithCodes {
  colorCodes?: string[];
  colorHexes?: string[];
  schemaVersion?: number;
}

function stripPaletteCodes(palette: StoredPalette | undefined): void {
  if (!palette || !Array.isArray(palette.colors)) {
    return;
  }
  palette.colors = palette.colors.map((color) => {
    const { code: _code, ...storedColor } = color;
    return storedColor;
  });
}

class MomoArtbeadsDatabase extends Dexie {
  projects!: Table<BeadProject, string>;
  selectionClipboard!: Table<SelectionClipboard, string>;
  customPaletteSchemes!: Table<CustomPaletteScheme, string>;

  constructor() {
    super(PROJECT_DATABASE_NAME);
    this.version(2).stores(DATABASE_SCHEMA);
    this.version(PROJECT_DATABASE_VERSION)
      .stores(DATABASE_SCHEMA)
      .upgrade(async (transaction) => {
        await transaction
          .table(PROJECT_TABLE_NAME)
          .toCollection()
          .modify((project: StoredProjectWithCodes) => {
            stripPaletteCodes(project.palette);
            stripPaletteCodes(
              project.editorState?.temporaryLayer?.palette
            );
          });
        await transaction
          .table(SELECTION_CLIPBOARD_TABLE_NAME)
          .toCollection()
          .modify((clipboard: StoredClipboardWithCodes) => {
            stripPaletteCodes(clipboard.board?.palette);
          });
        await transaction
          .table(CUSTOM_PALETTE_TABLE_NAME)
          .toCollection()
          .modify((scheme: StoredCustomPaletteWithCodes) => {
            if (!scheme.colorCodes) {
              return;
            }
            scheme.colorHexes = scheme.colorCodes
              .map((code) => artbeadHexForCode(code))
              .filter((hex): hex is string => Boolean(hex));
            delete scheme.colorCodes;
            scheme.schemaVersion = CUSTOM_PALETTE_SCHEMA_VERSION;
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
