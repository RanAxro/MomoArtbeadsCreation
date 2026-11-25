export enum BoardBackground {
  Solid = 'solid',
  Checker = 'checker',
  CheckerDense = 'checker-dense'
}

export interface ViewPreferences {
  showRulers: boolean;
  showGrid: boolean;
  background: BoardBackground;
}

export const DEFAULT_VIEW_PREFERENCES: ViewPreferences = {
  showRulers: true,
  showGrid: true,
  background: BoardBackground.Solid
};

export const VIEW_PREFERENCES_STORAGE_KEY =
  'momo-artbeads.view-preferences';
