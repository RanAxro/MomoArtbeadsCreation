export enum BoardBackground {
  Solid = 'solid',
  Checker = 'checker',
  CheckerDense = 'checker-dense'
}

export interface ViewPreferences {
  showRulers: boolean;
  showGrid: boolean;
  showCoarseGrid: boolean;
  coarseGridSpacing: number;
  background: BoardBackground;
}

export const DEFAULT_COARSE_GRID_SPACING = 5;
export const MIN_COARSE_GRID_SPACING = 2;
export const MAX_COARSE_GRID_SPACING = 100;

export const DEFAULT_VIEW_PREFERENCES: ViewPreferences = {
  showRulers: true,
  showGrid: true,
  showCoarseGrid: false,
  coarseGridSpacing: DEFAULT_COARSE_GRID_SPACING,
  background: BoardBackground.Solid
};

export const VIEW_PREFERENCES_STORAGE_KEY =
  'momo-artbeads.view-preferences';
