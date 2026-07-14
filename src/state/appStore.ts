import { create } from 'zustand';
import type { Locale } from '../i18n/messages';
import type { ModeId } from '../features/modes/modeRegistry';
import type { CountryRef } from '../features/globe/countryData';
import { parseUrlState } from './urlState';

interface GeoPoint {
  latitude: number;
  longitude: number;
}

interface AppState {
  locale: Locale;
  activeMode: ModeId;
  point: GeoPoint;
  selectedCountry: CountryRef | null;
  hoveredCountry: CountryRef | null;
  hasInteracted: boolean;
  selectMode: (mode: ModeId) => void;
  selectPoint: (point: GeoPoint) => void;
  setLocale: (locale: Locale) => void;
  setSelectedCountry: (country: CountryRef | null) => void;
  setHoveredCountry: (country: CountryRef | null) => void;
  markInteraction: () => void;
}

function preferredLocale(): Locale {
  if (typeof navigator === 'undefined') return 'zh';
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

const initialUrlState =
  typeof window === 'undefined'
    ? parseUrlState('')
    : parseUrlState(window.location.search);

export const useAppStore = create<AppState>((set) => ({
  locale: preferredLocale(),
  ...initialUrlState,
  selectedCountry: null,
  hoveredCountry: null,
  hasInteracted: false,
  selectMode: (activeMode) => set({ activeMode }),
  selectPoint: (point) => set({ point, hasInteracted: true }),
  setLocale: (locale) => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    set({ locale });
  },
  setSelectedCountry: (selectedCountry) =>
    set((state) =>
      state.selectedCountry?.countryId === selectedCountry?.countryId
        ? state
        : { selectedCountry },
    ),
  setHoveredCountry: (hoveredCountry) =>
    set((state) =>
      state.hoveredCountry?.countryId === hoveredCountry?.countryId
        ? state
        : { hoveredCountry },
    ),
  markInteraction: () => set({ hasInteracted: true }),
}));
