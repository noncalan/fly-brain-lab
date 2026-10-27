import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LANGS, STRINGS, type Lang, type StringKey } from './strings';

const STORAGE_KEY = 'fbl.lang';

export function detectLang(saved: string | null, browser: readonly string[]): Lang {
  if (saved && (LANGS as readonly string[]).includes(saved)) return saved as Lang;
  for (const tag of browser) {
    const base = tag.toLowerCase().split('-')[0];
    if ((LANGS as readonly string[]).includes(base)) return base as Lang;
  }
  return 'en';
}

export function format(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: StringKey, params?: Record<string, string | number>) => string;
  /** Locale-aware number formatting. */
  n: (value: number, digits?: number) => string;
}

const Ctx = createContext<I18n | null>(null);

function readSaved(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => detectLang(readSaved(), navigator.languages ?? [navigator.language]));

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // private mode: the choice just isn't remembered
    }
  }, []);

  const value = useMemo<I18n>(() => {
    const locale = lang === 'kk' ? 'kk-KZ' : lang === 'ru' ? 'ru-RU' : 'en-US';
    return {
      lang,
      setLang,
      t: (key, params) => format(STRINGS[lang][key], params),
      n: (v, digits = 0) => v.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }),
    };
  }, [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside I18nProvider');
  return v;
}

export { LANGS, type Lang, type StringKey };
