import { useCallback, useEffect, useState } from 'react';

const NS = 'leone:';
export function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(NS + key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
export function save<T>(key: string, value: T) {
  try { localStorage.setItem(NS + key, JSON.stringify(value)); } catch { /* quota */ }
  window.dispatchEvent(new CustomEvent('leone-store', { detail: key }));
}
export function resetAll() { Object.keys(localStorage).filter(k => k.startsWith(NS)).forEach(k => localStorage.removeItem(k)); }

/** localStorage-backed state, synced across components and tabs. */
export function useStored<T>(key: string, fallback: T): [T, (v: T | ((p: T) => T)) => void] {
  const [val, setVal] = useState<T>(() => load(key, fallback));
  useEffect(() => {
    const on = (e: Event) => { const k = (e as CustomEvent).detail ?? (e as StorageEvent).key?.slice(NS.length); if (k === key) setVal(load(key, fallback)); };
    window.addEventListener('leone-store', on);
    window.addEventListener('storage', on);
    return () => { window.removeEventListener('leone-store', on); window.removeEventListener('storage', on); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = useCallback((v: T | ((p: T) => T)) => {
    setVal(prev => { const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v; save(key, next); return next; });
  }, [key]);
  return [val, set];
}

export type ShelfBook = { id: number; title: string; author: string; cover?: string; lang?: string; addedAt: number };
export const useShelf = () => useStored<ShelfBook[]>('shelf', []);

export type Design = {
  font: string; size: number; leading: number; measure: number; theme: string;
  bg: string; ink: string; accent: string; align: 'left' | 'justify'; dropcap: boolean; indent: boolean;
  spineAnim: boolean; coverStyle: string; ornament: boolean;
};
export const THEMES: Record<string, Pick<Design, 'bg' | 'ink' | 'accent'>> = {
  Midnight: { bg: '#0b1020', ink: '#e9e2d0', accent: '#d8b46a' },
  Candlelight: { bg: '#1a120b', ink: '#f1dfbf', accent: '#e8a64a' },
  Parchment: { bg: '#f3ead6', ink: '#2b2116', accent: '#8a5a1f' },
  Ivory: { bg: '#fbf8f1', ink: '#1d1d22', accent: '#7a1f2b' },
  Sepia: { bg: '#e9dcc3', ink: '#3b2a18', accent: '#6b3e16' },
  Emerald: { bg: '#0b1a16', ink: '#dfeee6', accent: '#c8a75a' },
};
export const DEFAULT_DESIGN: Design = {
  font: 'Cormorant Garamond', size: 22, leading: 1.7, measure: 38, theme: 'Midnight', ...THEMES.Midnight,
  align: 'justify', dropcap: true, indent: true, spineAnim: true, coverStyle: 'Gilded', ornament: true,
};
export const useDesign = () => {
  const [d, set] = useStored<Design>('design', DEFAULT_DESIGN);
  return [{ ...DEFAULT_DESIGN, ...d }, set] as const;
};

export type Settings = { motion: boolean };
export const useSettings = () => useStored<Settings>('settings', { motion: !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches });

export type Highlight = { id: string; chapter: number; text: string; note?: string; at: number };
export type Progress = { chapter: number; pct: number; at: number };
export type Edit = { chapter: number; para: number; text: string; at: number };

export type Project = {
  id: string; kind: 'translation' | 'remix' | 'continuation'; title: string; sourceId: number | string; sourceTitle: string;
  detail: string; createdAt: number; status: 'draft' | 'awaiting-ai';
};
export const useProjects = () => useStored<Project[]>('projects', []);
export const uid = () => Math.random().toString(36).slice(2, 10);
