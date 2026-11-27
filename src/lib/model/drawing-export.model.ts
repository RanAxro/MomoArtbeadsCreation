import type { ViewPreferences } from './view.model';

export type DrawingExportSettings = ViewPreferences;

export const DRAWING_EXPORT_PREVIEW_MAX_DIMENSION = 2200;
export const DRAWING_EXPORT_MAX_DIMENSION = 4096;
export const DRAWING_EXPORT_MAX_PIXELS = 16_000_000;
export const DRAWING_EXPORT_FALLBACK_NAME = 'drawing';

export function createDrawingExportFilename(
  projectName: string,
  suffix: string
): string {
  const safeName =
    projectName
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/[. ]+$/g, '')
      .trim() || DRAWING_EXPORT_FALLBACK_NAME;
  const safeSuffix = suffix.trim().replace(/[\\/:*?"<>|]/g, '-');
  const baseName =
    safeName.replace(/[- ]+$/g, '') || DRAWING_EXPORT_FALLBACK_NAME;
  const joinedName = safeSuffix ? `${baseName}-${safeSuffix}` : baseName;
  return `${joinedName}.png`;
}
