export enum ThemeMode {
  Light = 'light',
  Dark = 'dark'
}

export enum AppLocale {
  ZhCN = 'zh-CN',
  EnUS = 'en-US'
}

export const DEFAULT_THEME_MODE = ThemeMode.Light;
export const DEFAULT_APP_LOCALE = AppLocale.ZhCN;
export const THEME_STORAGE_KEY = 'momo-artbeads.theme';
export const LOCALE_STORAGE_KEY = 'momo-artbeads.locale';
export const THEME_COLORS: Readonly<Record<ThemeMode, string>> = {
  [ThemeMode.Light]: '#f3f3f1',
  [ThemeMode.Dark]: '#0e0e0e'
};
