import { addMessages, init, locale } from 'svelte-i18n';
import {
  AppLocale,
  DEFAULT_APP_LOCALE,
  LOCALE_STORAGE_KEY
} from '$model/settings.model';
import enUS from './en-US.json';
import zhCN from './zh-CN.json';

export { AppLocale } from '$model/settings.model';

function storedLocale(): AppLocale {
  if (typeof window === 'undefined') {
    return DEFAULT_APP_LOCALE;
  }

  return window.localStorage.getItem(LOCALE_STORAGE_KEY) === AppLocale.EnUS
    ? AppLocale.EnUS
    : DEFAULT_APP_LOCALE;
}

addMessages(AppLocale.ZhCN, zhCN);
addMessages(AppLocale.EnUS, enUS);

const initialLocale = storedLocale();
init({
  fallbackLocale: DEFAULT_APP_LOCALE,
  initialLocale
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLocale;
}

export function setAppLocale(nextLocale: AppLocale): void {
  locale.set(nextLocale);
  window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
  document.documentElement.lang = nextLocale;
}
