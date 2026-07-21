import { create } from 'zustand';
import type { Locale } from '../i18n/messages';
import type { ModeId } from '../features/modes/modeRegistry';
import type { CountryRef } from '../features/globe/country';
import { antipodeOf, type GeoPoint } from '../features/antipodes/geography';
import type { DevelopmentIndicator } from '../features/development/developmentData';
import { parseUrlState } from './urlState';
import type { SunlineClockMode } from './urlState';
import { clampSunlineTime } from '../features/sunline/solar';

export interface CameraFocusIntent {
  side: 'origin' | 'antipode' | 'free' | 'nearest-place';
  target: GeoPoint | null;
}

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
  cameraFocusIntent: CameraFocusIntent;
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
  toggleAntipodeFocus: () => void;
  requestCameraFocus: (point: GeoPoint) => void;
  clearCameraTarget: () => void;
  setCameraFocusFree: () => void;
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
  cameraFocusIntent: { side: 'origin', target: null },
  hasInteracted: false,
  hasMeaningfulInteraction: false,
  sunlinePlaying: false,
  selectMode: (activeMode) =>
    set({
      activeMode,
      hoveredCountry: null,
      cameraFocusIntent: { side: 'free', target: null },
      sunlinePlaying: false,
    }),
  selectPoint: (point) =>
    set({
      point,
      cameraFocusIntent: { side: 'origin', target: point },
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
  toggleAntipodeFocus: () =>
    set((state) => {
      const side =
        state.cameraFocusIntent.side === 'antipode' ? 'origin' : 'antipode';
      return {
        cameraFocusIntent: {
          side,
          target: side === 'origin' ? state.point : antipodeOf(state.point),
        },
        hasInteracted: true,
      };
    }),
  requestCameraFocus: (target) =>
    set({
      cameraFocusIntent: { side: 'nearest-place', target },
      hasInteracted: true,
    }),
  clearCameraTarget: () =>
    set((state) => ({
      cameraFocusIntent: { ...state.cameraFocusIntent, target: null },
    })),
  setCameraFocusFree: () =>
    set({ cameraFocusIntent: { side: 'free', target: null } }),
  markInteraction: () => set({ hasInteracted: true }),
  markMeaningfulInteraction: () =>
    set({ hasInteracted: true, hasMeaningfulInteraction: true }),
}));
