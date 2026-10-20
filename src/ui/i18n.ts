// All UI text lives in src/data/strings/<lang>.json. t() looks keys up and
// fills {placeholders}. Missing keys fall back to English, then to the key.
import en from '../data/strings/en.json';

type Dict = Record<string, string>;

const tables: Record<string, Dict> = { en: en as Dict };
let current: Dict = tables.en!;

export function setLanguage(lang: string, dict?: Dict): void {
  if (dict) tables[lang] = dict;
  current = tables[lang] ?? tables.en!;
  document.documentElement.lang = lang;
}

export function has(key: string): boolean {
  return key in current || key in tables.en!;
}

export function t(key: string, params?: Record<string, string | number>): string {
  let s = current[key] ?? tables.en![key] ?? key;
  if (params) {
    s = s.replace(/\{(\w+)\}/g, (m, k: string) => {
      const v = params[k];
      return v === undefined ? m : typeof v === 'number' ? fmt(v) : v;
    });
  }
  return s;
}

const nf = new Intl.NumberFormat();
export function fmt(n: number): string {
  return nf.format(Math.round(n));
}

export function shortNum(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}k`;
  return fmt(n);
}

/** "2h 5m", "45s" ... */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  if (s <= 0) return t('time.ready');
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return h > 0 ? `${t('time.d', { n: d })} ${t('time.h', { n: h })}` : t('time.d', { n: d });
  if (h > 0) return m > 0 ? `${t('time.h', { n: h })} ${t('time.m', { n: m })}` : t('time.h', { n: h });
  if (m > 0) return m >= 10 || sec === 0 ? t('time.m', { n: m }) : `${t('time.m', { n: m })} ${t('time.s', { n: sec })}`;
  return t('time.s', { n: sec });
}

export function itemName(id: string): string {
  return t(`item.${id}`);
}
