import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { pl, type Dict } from './pl';
import { szl } from './szl';

export type Lang = 'pl' | 'szl';
export type TKey = keyof typeof pl;

const DICTS: Record<Lang, Dict> = { pl, szl };
const STORAGE_KEY = 'nawykomator.lang';

function initialLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'pl' || v === 'szl') return v;
  } catch {
    /* brak localStorage */
  }
  return 'pl';
}

let current: Lang = initialLang();
const subs = new Set<(l: Lang) => void>();

export function t(key: TKey, vars?: Record<string, string | number>): string {
  let s: string = DICTS[current][key] ?? pl[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Odmiana liczebnikowa: wartość w słowniku "krok|kroki|kroków" (1 | 2–4 | 5+) */
export function tn(key: TKey, n: number, vars?: Record<string, string | number>): string {
  const forms = t(key, { n, ...vars }).split('|');
  if (forms.length < 3) return forms[0];
  const m10 = n % 10;
  const m100 = n % 100;
  if (n === 1) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
  return forms[2];
}

export function getLang(): Lang {
  return current;
}

export function setLang(l: Lang) {
  current = l;
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = l === 'szl' ? 'szl' : 'pl';
  subs.forEach((fn) => fn(l));
}

const LangContext = createContext<Lang>(current);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setL] = useState<Lang>(current);
  useEffect(() => {
    subs.add(setL);
    return () => {
      subs.delete(setL);
    };
  }, []);
  // App czyta useLang(), więc zmiana języka przerysowuje całe drzewo (bez gubienia stanu)
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

export const DAY_KEYS: TKey[] = ['day.0', 'day.1', 'day.2', 'day.3', 'day.4', 'day.5', 'day.6'];
/** kolejność dni w UI: poniedziałek pierwszy */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
