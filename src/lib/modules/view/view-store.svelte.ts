import {
  BoardBackground,
  DEFAULT_VIEW_PREFERENCES,
  DEFAULT_COARSE_GRID_SPACING,
  MAX_COARSE_GRID_SPACING,
  MIN_COARSE_GRID_SPACING,
  VIEW_PREFERENCES_STORAGE_KEY,
  type ViewPreferences
} from '$model/view.model';

function clampCoarseGridSpacing(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_COARSE_GRID_SPACING;
  }
  return Math.max(
    MIN_COARSE_GRID_SPACING,
    Math.min(MAX_COARSE_GRID_SPACING, Math.round(value))
  );
}

function readViewPreferences(): ViewPreferences {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_VIEW_PREFERENCES };
  }

  try {
    const stored = JSON.parse(
      window.localStorage.getItem(VIEW_PREFERENCES_STORAGE_KEY) ?? '{}'
    ) as Partial<ViewPreferences>;
    return {
      showRulers:
        typeof stored.showRulers === 'boolean'
          ? stored.showRulers
          : DEFAULT_VIEW_PREFERENCES.showRulers,
      showGrid:
        typeof stored.showGrid === 'boolean'
          ? stored.showGrid
          : DEFAULT_VIEW_PREFERENCES.showGrid,
      showCoarseGrid:
        typeof stored.showCoarseGrid === 'boolean'
          ? stored.showCoarseGrid
          : DEFAULT_VIEW_PREFERENCES.showCoarseGrid,
      coarseGridSpacing:
        typeof stored.coarseGridSpacing === 'number'
          ? clampCoarseGridSpacing(stored.coarseGridSpacing)
          : DEFAULT_VIEW_PREFERENCES.coarseGridSpacing,
      background:
        stored.background === BoardBackground.Checker ||
        stored.background === BoardBackground.CheckerDense
          ? stored.background
          : DEFAULT_VIEW_PREFERENCES.background
    };
  } catch {
    return { ...DEFAULT_VIEW_PREFERENCES };
  }
}

const initialViewPreferences = readViewPreferences();

class ViewStore {
  showRulers = $state(initialViewPreferences.showRulers);
  showGrid = $state(initialViewPreferences.showGrid);
  showCoarseGrid = $state(initialViewPreferences.showCoarseGrid);
  coarseGridSpacing = $state(initialViewPreferences.coarseGridSpacing);
  background = $state(initialViewPreferences.background);

  setShowRulers(visible: boolean): void {
    this.showRulers = visible;
    this.persist();
  }

  setShowGrid(visible: boolean): void {
    this.showGrid = visible;
    this.persist();
  }

  setShowCoarseGrid(visible: boolean): void {
    this.showCoarseGrid = visible;
    this.persist();
  }

  setCoarseGridSpacing(spacing: number): void {
    this.coarseGridSpacing = clampCoarseGridSpacing(spacing);
    this.persist();
  }

  setBackground(background: BoardBackground): void {
    this.background = background;
    this.persist();
  }

  private persist(): void {
    window.localStorage.setItem(
      VIEW_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        showRulers: this.showRulers,
        showGrid: this.showGrid,
        showCoarseGrid: this.showCoarseGrid,
        coarseGridSpacing: this.coarseGridSpacing,
        background: this.background
      } satisfies ViewPreferences)
    );
  }
}

export const viewStore = new ViewStore();
