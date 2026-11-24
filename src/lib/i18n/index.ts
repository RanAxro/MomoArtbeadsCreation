import { addMessages, init, locale } from 'svelte-i18n';
import enUS from './en-US.json';
import zhCN from './zh-CN.json';

export type AppLocale = 'zh-CN' | 'en-US';

const LOCALE_KEY = 'momo-artbeads.locale';

function storedLocale(): AppLocale {
  if (typeof window === 'undefined') {
    return 'zh-CN';
  }

  return window.localStorage.getItem(LOCALE_KEY) === 'en-US' ? 'en-US' : 'zh-CN';
}

addMessages('zh-CN', zhCN);
addMessages('en-US', enUS);

const initialLocale = storedLocale();
init({
  fallbackLocale: 'zh-CN',
  initialLocale
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLocale;
}

export function setAppLocale(nextLocale: AppLocale): void {
  locale.set(nextLocale);
  window.localStorage.setItem(LOCALE_KEY, nextLocale);
  document.documentElement.lang = nextLocale;
}
