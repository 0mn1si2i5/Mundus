import { create } from 'zustand';
import type { Locale } from '../i18n/messages';
import type { ModeId } from '../features/modes/modeRegistry';
import type { CountryRef } from '../features/globe/countryData';
import type { GeoPoint } from '../features/globe/geo';
import type { DevelopmentIndicator } from '../features/development/developmentData';
import { parseUrlState } from './urlState';

interface AppState {
  locale: Locale;
  activeMode: ModeId;
  point: GeoPoint;
  developmentIndicator: DevelopmentIndicator;
  developmentYear: number;
  selectedCountry: CountryRef | null;
  antipodeCountry: CountryRef | null;
  hoveredCountry: CountryRef | null;
  cameraTarget: GeoPoint | null;
  hasInteracted: boolean;
  selectMode: (mode: ModeId) => void;
  selectPoint: (point: GeoPoint) => void;
  selectDevelopmentIndicator: (indicator: DevelopmentIndicator) => void;
  selectDevelopmentYear: (year: number) => void;
  setLocale: (locale: Locale) => void;
  setSelectedCountry: (country: CountryRef | null) => void;
  setAntipodeCountry: (country: CountryRef | null) => void;
  setHoveredCountry: (country: CountryRef | null) => void;
  requestCameraFocus: (point: GeoPoint) => void;
  clearCameraTarget: () => void;
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
  antipodeCountry: null,
  hoveredCountry: null,
  cameraTarget: null,
  hasInteracted: false,
  selectMode: (activeMode) =>
    set({ activeMode, hoveredCountry: null, cameraTarget: null }),
  selectPoint: (point) =>
    set({ point, cameraTarget: point, hasInteracted: true }),
  selectDevelopmentIndicator: (developmentIndicator) =>
    set({ developmentIndicator }),
  selectDevelopmentYear: (developmentYear) => set({ developmentYear }),
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
  setAntipodeCountry: (antipodeCountry) =>
    set((state) =>
      state.antipodeCountry?.countryId === antipodeCountry?.countryId
        ? state
        : { antipodeCountry },
    ),
  setHoveredCountry: (hoveredCountry) =>
    set((state) =>
      state.hoveredCountry?.countryId === hoveredCountry?.countryId
        ? state
        : { hoveredCountry },
    ),
  requestCameraFocus: (cameraTarget) =>
    set({ cameraTarget, hasInteracted: true }),
  clearCameraTarget: () => set({ cameraTarget: null }),
  markInteraction: () => set({ hasInteracted: true }),
}));
