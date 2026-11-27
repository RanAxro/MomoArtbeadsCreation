import {
  exportDB,
  importInto,
  peakImportFile,
  type ExportProgress
} from 'dexie-export-import';
import {
  customPaletteSchemeSchema,
  type CustomPaletteScheme
} from '$model/custom-palette.model';
import { beadProjectSchema, type BeadProject } from '$model/project.model';
import {
  CUSTOM_PALETTE_TABLE_NAME,
  PROJECT_DATABASE_VERSION,
  PROJECT_DATABASE_NAME,
  PROJECT_TABLE_NAME,
  SELECTION_CLIPBOARD_TABLE_NAME
} from '$model/data.model';
import {
  selectionClipboardSchema,
  type SelectionClipboard
} from '$model/selection-clipboard.model';
import { getArtbeadsDatabase } from './database';
import { selectionClipboardRepository } from './selection-clipboard-repository';

const BACKUP_TABLE_NAMES = new Set([
  PROJECT_TABLE_NAME,
  SELECTION_CLIPBOARD_TABLE_NAME,
  CUSTOM_PALETTE_TABLE_NAME
]);

export type DatabaseBackupErrorCode =
  | 'invalid-export'
  | 'wrong-database'
  | 'unknown-table'
  | 'invalid-project'
  | 'invalid-clipboard'
  | 'invalid-custom-palette';

export class DatabaseBackupError extends Error {
  constructor(
    readonly code: DatabaseBackupErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'DatabaseBackupError';
  }
}

export interface BackupImportOptions {
  clipboardLimit: number;
  onProgress?: (progress: {
    totalTables: number;
    completedTables: number;
    totalRows: number | undefined;
    completedRows: number;
    done: boolean;
  }) => void;
}

export interface BackupImportSummary {
  projectsImported: number;
  clipboardsImported: number;
  customPalettesImported: number;
}

export async function createDatabaseBackup(
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  return exportDB(getArtbeadsDatabase(), {
    prettyJson: false,
    progressCallback: (progress) => {
      onProgress?.(progress);
      return true;
    }
  });
}

export function createBackupFilename(date = new Date()): string {
  const timestamp = date
    .toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace(/\.\d{3}Z$/, 'Z');
  return `MomoArtbeadsCreation-${timestamp}.json`;
}

export function downloadDatabaseBackup(
  backup: Blob,
  filename = createBackupFilename()
): void {
  const url = URL.createObjectURL(backup);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importDatabaseBackup(
  file: Blob,
  options: BackupImportOptions
): Promise<BackupImportSummary> {
  await readAndValidateMetadata(file);
  const database = getArtbeadsDatabase();
  const [projects, clipboards, customPalettes] = await Promise.all([
    database.projects.toArray(),
    selectionClipboardRepository.list(),
    database.customPaletteSchemes.toArray()
  ]);
  const projectUpdatedAt = new Map(
    projects.map((project) => [project.id, timestampOf(project.updatedAt)])
  );
  const clipboardLastUsedAt = new Map(
    clipboards.map((clipboard) => [
      clipboard.id,
      clipboardRecencyOf(clipboard)
    ])
  );
  const customPaletteUpdatedAt = new Map(
    customPalettes.map((scheme) => [scheme.id, timestampOf(scheme.updatedAt)])
  );
  let projectsImported = 0;
  let clipboardsImported = 0;
  let customPalettesImported = 0;

  try {
    await importInto(database, file, {
      overwriteValues: true,
      progressCallback: (progress) => {
        options.onProgress?.(progress);
        return true;
      },
      filter: (tableName, value) => {
        if (tableName === PROJECT_TABLE_NAME) {
          const project = validateProjectRecord(value);
          const nextUpdatedAt = timestampOf(project.updatedAt);
          const currentUpdatedAt = projectUpdatedAt.get(project.id);

          if (
            currentUpdatedAt !== undefined &&
            nextUpdatedAt <= currentUpdatedAt
          ) {
            return false;
          }

          projectUpdatedAt.set(project.id, nextUpdatedAt);
          projectsImported += 1;
          return true;
        }

        if (tableName === SELECTION_CLIPBOARD_TABLE_NAME) {
          const clipboard = validateClipboardRecord(value);
          const nextLastUsedAt = clipboardRecencyOf(clipboard);
          const currentLastUsedAt = clipboardLastUsedAt.get(clipboard.id);

          if (
            currentLastUsedAt !== undefined &&
            nextLastUsedAt <= currentLastUsedAt
          ) {
            return false;
          }

          clipboardLastUsedAt.set(clipboard.id, nextLastUsedAt);
          clipboardsImported += 1;
          return true;
        }

        if (tableName === CUSTOM_PALETTE_TABLE_NAME) {
          const scheme = validateCustomPaletteRecord(value);
          const nextUpdatedAt = timestampOf(scheme.updatedAt);
          const currentUpdatedAt = customPaletteUpdatedAt.get(scheme.id);

          if (
            currentUpdatedAt !== undefined &&
            nextUpdatedAt <= currentUpdatedAt
          ) {
            return false;
          }

          customPaletteUpdatedAt.set(scheme.id, nextUpdatedAt);
          customPalettesImported += 1;
          return true;
        }

        throw new DatabaseBackupError(
          'unknown-table',
          `Unsupported backup table: ${tableName}`
        );
      }
    });
  } catch (error) {
    if (error instanceof DatabaseBackupError) {
      throw error;
    }
    throw new DatabaseBackupError(
      'invalid-export',
      'The backup could not be imported.',
      { cause: error }
    );
  }

  await selectionClipboardRepository.prune(
    Math.max(1, Math.round(options.clipboardLimit))
  );

  return {
    projectsImported,
    clipboardsImported,
    customPalettesImported
  };
}

export async function validateBackupFile(file: Blob): Promise<void> {
  await readAndValidateMetadata(file);
}

async function readAndValidateMetadata(
  file: Blob
): Promise<Awaited<ReturnType<typeof peakImportFile>>> {
  let metadata: Awaited<ReturnType<typeof peakImportFile>>;

  try {
    metadata = await peakImportFile(file);
  } catch (error) {
    throw new DatabaseBackupError(
      'invalid-export',
      'The selected file is not a Dexie backup.',
      { cause: error }
    );
  }

  if (
    metadata.formatName !== 'dexie' ||
    metadata.formatVersion !== 1 ||
    !metadata.data ||
    metadata.data.databaseVersion !== PROJECT_DATABASE_VERSION ||
    !Array.isArray(metadata.data.tables)
  ) {
    throw new DatabaseBackupError(
      'invalid-export',
      'The selected file has an unsupported backup format.'
    );
  }

  if (metadata.data.databaseName !== PROJECT_DATABASE_NAME) {
    throw new DatabaseBackupError(
      'wrong-database',
      `Expected the ${PROJECT_DATABASE_NAME} database.`
    );
  }

  const tableNames = new Set(
    metadata.data.tables.map((table) => table.name)
  );
  for (const tableName of tableNames) {
    if (!BACKUP_TABLE_NAMES.has(tableName)) {
      throw new DatabaseBackupError(
        'unknown-table',
        `Unsupported backup table: ${tableName}`
      );
    }
  }

  if (
    !tableNames.has(PROJECT_TABLE_NAME) ||
    !tableNames.has(SELECTION_CLIPBOARD_TABLE_NAME) ||
    !tableNames.has(CUSTOM_PALETTE_TABLE_NAME)
  ) {
    throw new DatabaseBackupError(
      'invalid-export',
      'The backup is missing required tables.'
    );
  }

  return metadata;
}

function validateProjectRecord(value: unknown): BeadProject {
  const result = beadProjectSchema.safeParse(value);
  if (!result.success) {
    throw new DatabaseBackupError(
      'invalid-project',
      'The backup contains an invalid project.'
    );
  }

  const project = result.data;
  if (
    project.cells.length !== project.width * project.height ||
    project.cells.some((cell) => cell > project.palette.colors.length)
  ) {
    throw new DatabaseBackupError(
      'invalid-project',
      'The backup contains an invalid project board.'
    );
  }

  const selection = project.editorState.selectionCells;
  if (selection.some((index) => index >= project.cells.length)) {
    throw new DatabaseBackupError(
      'invalid-project',
      'The backup contains an invalid project selection.'
    );
  }

  const layer = project.editorState.temporaryLayer;
  if (
    layer &&
    (layer.cells.length !== layer.width * layer.height ||
      layer.cells.some((cell) => cell > layer.palette.colors.length) ||
      layer.selectionCells.some((index) => index >= layer.cells.length))
  ) {
    throw new DatabaseBackupError(
      'invalid-project',
      'The backup contains an invalid temporary layer.'
    );
  }

  return project;
}

function validateClipboardRecord(value: unknown): SelectionClipboard {
  const result = selectionClipboardSchema.safeParse(value);
  if (!result.success) {
    throw new DatabaseBackupError(
      'invalid-clipboard',
      'The backup contains invalid clipboard data.'
    );
  }
  return result.data;
}

function validateCustomPaletteRecord(value: unknown): CustomPaletteScheme {
  const result = customPaletteSchemeSchema.safeParse(value);
  if (!result.success) {
    throw new DatabaseBackupError(
      'invalid-custom-palette',
      'The backup contains an invalid custom palette.'
    );
  }
  return result.data;
}

function timestampOf(value: string): number {
  return Date.parse(value);
}

function clipboardRecencyOf(clipboard: SelectionClipboard): number {
  return timestampOf(clipboard.lastUsedAt);
}
