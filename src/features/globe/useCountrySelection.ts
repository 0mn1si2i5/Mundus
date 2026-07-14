import { useEffect } from 'react';
import { useAppStore } from '../../state/appStore';
import { getCountryDataset } from './countryData';
import { antipodeOf } from './geo';

/** Resolve geographic meaning independently from the optional WebGL renderer. */
export function useCountrySelection() {
  const point = useAppStore((state) => state.point);
  const setSelectedCountry = useAppStore((state) => state.setSelectedCountry);
  const setAntipodeCountry = useAppStore((state) => state.setAntipodeCountry);

  useEffect(() => {
    const countries = getCountryDataset();
    setSelectedCountry(countries.findCountry(point));
    setAntipodeCountry(countries.findCountry(antipodeOf(point)));
  }, [point, setAntipodeCountry, setSelectedCountry]);
}
