import { create } from 'zustand';
import type { Locale } from '../i18n/messages';
import type { ModeId } from '../features/modes/modeRegistry';

interface GeoPoint {
  latitude: number;
  longitude: number;
}

interface AppState {
  locale: Locale;
  activeMode: ModeId;
  point: GeoPoint;
  hasInteracted: boolean;
  selectMode: (mode: ModeId) => void;
  selectPoint: (point: GeoPoint) => void;
  setLocale: (locale: Locale) => void;
  markInteraction: () => void;
}

function preferredLocale(): Locale {
  if (typeof navigator === 'undefined') return 'zh';
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export const useAppStore = create<AppState>((set) => ({
  locale: preferredLocale(),
  activeMode: 'antipodes',
  point: { latitude: 31.2304, longitude: 121.4737 },
  hasInteracted: false,
  selectMode: (activeMode) => set({ activeMode }),
  selectPoint: (point) => set({ point, hasInteracted: true }),
  setLocale: (locale) => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    set({ locale });
  },
  markInteraction: () => set({ hasInteracted: true }),
}));
