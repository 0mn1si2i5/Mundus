import { create } from 'zustand';
import type { Locale } from '../i18n/messages';
import type { ModeId } from '../features/modes/modeRegistry';
import type { CountryRef } from '../features/globe/countryData';
import type { GeoPoint } from '../features/globe/geo';
import type { DevelopmentIndicator } from '../features/development/developmentData';
import { parseUrlState } from './urlState';
import type { SunlineClockMode } from './urlState';
import { clampSunlineTime } from '../features/sunline/solar';

interface AppState {
  locale: Locale;
  activeMode: ModeId;
  point: GeoPoint;
  developmentIndicator: DevelopmentIndicator;
  developmentYear: number;
  sunlineTimeMs: number;
  sunlineClockMode: SunlineClockMode;
  sunlinePlaying: boolean;
  selectedCountry: CountryRef | null;
  antipodeCountry: CountryRef | null;
  hoveredCountry: CountryRef | null;
  cameraTarget: GeoPoint | null;
  hasInteracted: boolean;
  hasMeaningfulInteraction: boolean;
  selectMode: (mode: ModeId) => void;
  selectPoint: (point: GeoPoint) => void;
  selectDevelopmentIndicator: (indicator: DevelopmentIndicator) => void;
  selectDevelopmentYear: (year: number) => void;
  selectSunlineTime: (timestampMs: number) => void;
  advanceSunlineTime: (elapsedRealMs: number) => void;
  syncSunlineLiveTime: (timestampMs?: number) => void;
  setSunlinePlaying: (playing: boolean) => void;
  returnSunlineToLive: (timestampMs?: number) => void;
  setLocale: (locale: Locale) => void;
  setSelectedCountry: (country: CountryRef | null) => void;
  setAntipodeCountry: (country: CountryRef | null) => void;
  setHoveredCountry: (country: CountryRef | null) => void;
  requestCameraFocus: (point: GeoPoint) => void;
  clearCameraTarget: () => void;
  markInteraction: () => void;
  markMeaningfulInteraction: () => void;
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
  hasMeaningfulInteraction: false,
  sunlinePlaying: false,
  selectMode: (activeMode) =>
    set({
      activeMode,
      hoveredCountry: null,
      cameraTarget: null,
      sunlinePlaying: false,
    }),
  selectPoint: (point) =>
    set({
      point,
      cameraTarget: point,
      hasInteracted: true,
      hasMeaningfulInteraction: true,
    }),
  selectDevelopmentIndicator: (developmentIndicator) =>
    set({ developmentIndicator }),
  selectDevelopmentYear: (developmentYear) => set({ developmentYear }),
  selectSunlineTime: (sunlineTimeMs) =>
    set({
      sunlineTimeMs: clampSunlineTime(sunlineTimeMs),
      sunlineClockMode: 'fixed',
      sunlinePlaying: false,
    }),
  advanceSunlineTime: (elapsedRealMs) =>
    set((state) => {
      const sunlineTimeMs = clampSunlineTime(
        state.sunlineTimeMs + elapsedRealMs * 1440,
      );
      return {
        sunlineTimeMs,
        sunlineClockMode: 'fixed',
        sunlinePlaying:
          state.sunlinePlaying &&
          sunlineTimeMs < Date.UTC(2099, 11, 31, 23, 59),
      };
    }),
  syncSunlineLiveTime: (timestampMs = Date.now()) =>
    set((state) => {
      if (state.sunlineClockMode !== 'live') return state;
      const sunlineTimeMs = clampSunlineTime(timestampMs);
      return state.sunlineTimeMs === sunlineTimeMs ? state : { sunlineTimeMs };
    }),
  setSunlinePlaying: (sunlinePlaying) =>
    set((state) => ({
      sunlinePlaying,
      sunlineClockMode: sunlinePlaying ? 'fixed' : state.sunlineClockMode,
    })),
  returnSunlineToLive: (timestampMs = Date.now()) =>
    set({
      sunlineTimeMs: clampSunlineTime(timestampMs),
      sunlineClockMode: 'live',
      sunlinePlaying: false,
    }),
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
  markMeaningfulInteraction: () =>
    set({ hasInteracted: true, hasMeaningfulInteraction: true }),
}));
