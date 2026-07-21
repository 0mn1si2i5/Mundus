import { useMemo } from 'react';
import { useAppStore } from '../../state/appStore';
import { antipodeOf, type GeoPoint } from '../globe/geo';
import type { CountryRef } from '../globe/countryData';
import {
  useNearestPopulatedPlace,
  type PopulatedPlaceLoadState,
} from '../antipodes/populatedPlaces';
import {
  developmentColor,
  valuesByCountryId,
} from '../development/developmentData';
import {
  useDevelopmentDataset,
  type DevelopmentLoadState,
} from '../development/useDevelopmentDataset';
import { observeSun, solarEventsUtc, solarPosition } from '../sunline/solar';
import type { SunlineRenderState } from '../globe/GlobeViewport';
import {
  useGeoNamesCityIndex,
  type GeoNamesCityLoadState,
} from '../antipodes/useGeoNamesCityIndex';

interface GlobePresentation {
  countryFills: ReadonlyMap<string, string> | null;
  showAntipodes: boolean;
  sunline: SunlineRenderState | null;
}

export type ModePresentation =
  | {
      id: 'antipodes';
      globe: GlobePresentation;
      point: GeoPoint;
      antipode: GeoPoint;
      selectedCountry: CountryRef | null;
      antipodeCountry: CountryRef | null;
      nearestPlace: PopulatedPlaceLoadState;
      cityIndex: GeoNamesCityLoadState;
    }
  | {
      id: 'development';
      globe: GlobePresentation;
      selectedCountry: CountryRef | null;
      developmentData: DevelopmentLoadState;
    }
  | {
      id: 'sunline';
      globe: GlobePresentation;
      point: GeoPoint;
      selectedCountry: CountryRef | null;
      sun: {
        position: ReturnType<typeof solarPosition>;
        observation: ReturnType<typeof observeSun>;
        events: ReturnType<typeof solarEventsUtc>;
      };
    };

export function useModePresentation(): ModePresentation {
  const activeMode = useAppStore((state) => state.activeMode);
  const point = useAppStore((state) => state.point);
  const selectedCountry = useAppStore((state) => state.selectedCountry);
  const antipodeCountry = useAppStore((state) => state.antipodeCountry);
  const indicator = useAppStore((state) => state.developmentIndicator);
  const year = useAppStore((state) => state.developmentYear);
  const sunlineTimeMs = useAppStore((state) => state.sunlineTimeMs);
  const antipode = antipodeOf(point);
  const nearestPlace = useNearestPopulatedPlace(
    antipode,
    activeMode === 'antipodes',
  );
  const developmentData = useDevelopmentDataset(activeMode === 'development');
  const cityIndex = useGeoNamesCityIndex(activeMode === 'antipodes');
  const developmentFills = useMemo(() => {
    if (developmentData.status !== 'ready') return null;
    return new Map(
      [...valuesByCountryId(developmentData.data, indicator, year)].map(
        ([countryId, value]) => [countryId, developmentColor(value)],
      ),
    );
  }, [developmentData, indicator, year]);
  const sun = useMemo(() => {
    const position = solarPosition(sunlineTimeMs);
    return {
      position,
      observation: observeSun(point, sunlineTimeMs),
      events: solarEventsUtc(point, sunlineTimeMs),
    };
  }, [point, sunlineTimeMs]);

  switch (activeMode) {
    case 'antipodes':
      return {
        id: activeMode,
        globe: { countryFills: null, showAntipodes: true, sunline: null },
        point,
        antipode,
        selectedCountry,
        antipodeCountry,
        nearestPlace,
        cityIndex,
      };
    case 'development':
      return {
        id: activeMode,
        globe: {
          countryFills: developmentFills,
          showAntipodes: false,
          sunline: null,
        },
        selectedCountry,
        developmentData,
      };
    case 'sunline':
      return {
        id: activeMode,
        globe: {
          countryFills: null,
          showAntipodes: false,
          sunline: { subsolarPoint: sun.position.subsolarPoint },
        },
        point,
        selectedCountry,
        sun,
      };
    default:
      return assertNever(activeMode);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled mode: ${String(value)}`);
}
