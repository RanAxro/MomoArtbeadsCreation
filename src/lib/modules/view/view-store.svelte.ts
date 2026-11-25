import {
  BoardBackground,
  DEFAULT_VIEW_PREFERENCES,
  VIEW_PREFERENCES_STORAGE_KEY,
  type ViewPreferences
} from '$model/view.model';

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
  background = $state(initialViewPreferences.background);

  setShowRulers(visible: boolean): void {
    this.showRulers = visible;
    this.persist();
  }

  setShowGrid(visible: boolean): void {
    this.showGrid = visible;
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
        background: this.background
      } satisfies ViewPreferences)
    );
  }
}

export const viewStore = new ViewStore();
