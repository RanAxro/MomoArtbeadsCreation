export type ThemeMode = 'light' | 'dark';

const THEME_KEY = 'momo-artbeads.theme';

function readTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light';
  }

  return window.localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
}

class ThemeStore {
  mode = $state<ThemeMode>(readTheme());

  set(nextTheme: ThemeMode): void {
    this.mode = nextTheme;
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(THEME_KEY, nextTheme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', nextTheme === 'dark' ? '#0e0e0e' : '#f3f3f1');
  }

  initialize(): void {
    document.documentElement.dataset.theme = this.mode;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', this.mode === 'dark' ? '#0e0e0e' : '#f3f3f1');
  }
}

export const themeStore = new ThemeStore();
