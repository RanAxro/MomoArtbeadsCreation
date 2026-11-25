import {
  DEFAULT_THEME_MODE,
  THEME_COLORS,
  THEME_STORAGE_KEY,
  ThemeMode
} from '$model/settings.model';

export { ThemeMode } from '$model/settings.model';

function readTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME_MODE;
  }

  return window.localStorage.getItem(THEME_STORAGE_KEY) === ThemeMode.Dark
    ? ThemeMode.Dark
    : DEFAULT_THEME_MODE;
}

class ThemeStore {
  mode = $state<ThemeMode>(readTheme());

  set(nextTheme: ThemeMode): void {
    this.mode = nextTheme;
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLORS[nextTheme]);
  }

  initialize(): void {
    document.documentElement.dataset.theme = this.mode;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLORS[this.mode]);
  }
}

export const themeStore = new ThemeStore();
