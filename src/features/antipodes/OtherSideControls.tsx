import { useMemo, useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import type { Locale } from '../../i18n/messages';
import { useAppStore } from '../../state/appStore';
import { ModePanel, type ModePanelHandle } from '../controls/ModePanel';
import { antipodeOf } from '../globe/geo';
import { FEATURED_CITIES, searchCities, type CityEntry } from './cities';
import styles from './OtherSideControls.module.css';

const requiredCoordinate = (minimum: number, maximum: number) =>
  z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.coerce.number().min(minimum).max(maximum),
  );

const coordinateSchema = z.object({
  latitude: requiredCoordinate(-90, 90),
  longitude: requiredCoordinate(-180, 180),
});

const COPY = {
  zh: {
    title: '选择一个起点',
    search: '搜索本地城市',
    searchPlaceholder: '城市或国家',
    coordinates: '坐标',
    latitude: '纬度',
    longitude: '经度',
    apply: '前往',
    locate: '使用我的位置',
    locating: '正在定位…',
    locationError: '无法读取位置，请检查浏览器权限。',
    invalid: '纬度需在 ±90°、经度需在 ±180° 内。',
    flip: '翻到另一端',
    examples: '精选起点',
    method: '数据与方法',
    methodText:
      '对跖点通过纬度取反并将经度旋转 180° 计算。国家或海洋判断使用 Natural Earth 110m；最近聚居地使用 Natural Earth 50m 精选点，并非完整城市名录。边界是制图表达，不是领土法律权威。',
    attribution: 'Made with Natural Earth · 公共领域数据',
    source: 'Natural Earth 来源',
    terms: '使用条款',
    show: '展开地点控件',
    hide: '收起地点控件',
  },
  en: {
    title: 'Choose a starting point',
    search: 'Search local cities',
    searchPlaceholder: 'City or country',
    coordinates: 'Coordinates',
    latitude: 'Latitude',
    longitude: 'Longitude',
    apply: 'Go',
    locate: 'Use my location',
    locating: 'Locating…',
    locationError: 'Location is unavailable. Check browser permission.',
    invalid: 'Latitude must be within ±90° and longitude within ±180°.',
    flip: 'See the other side',
    examples: 'Featured starts',
    method: 'Data and method',
    methodText:
      'The antipode negates latitude and rotates longitude by 180°. Country or ocean lookup uses Natural Earth 110m; the nearest populated place uses the selected Natural Earth 50m index, not a complete gazetteer. Boundaries are a cartographic view, not a legal authority on territorial status.',
    attribution: 'Made with Natural Earth · public domain data',
    source: 'Natural Earth source',
    terms: 'Terms of use',
    show: 'Expand place controls',
    hide: 'Collapse place controls',
  },
} as const;

const EXAMPLE_IDS = new Set(['shanghai', 'madrid', 'honolulu']);

export function OtherSideControls({ locale }: { locale: Locale }) {
  const point = useAppStore((state) => state.point);
  const selectPoint = useAppStore((state) => state.selectPoint);
  const requestCameraFocus = useAppStore((state) => state.requestCameraFocus);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const panel = useRef<ModePanelHandle>(null);
  const copy = COPY[locale];
  const results = useMemo(() => searchCities(query, locale), [locale, query]);
  const examples = FEATURED_CITIES.filter((city) => EXAMPLE_IDS.has(city.id));

  function chooseCity(city: CityEntry) {
    selectPoint(city.point);
    setQuery('');
    setError('');
    panel.current?.collapseIfMobile();
  }

  function submitCoordinates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = coordinateSchema.safeParse({
      latitude: data.get('latitude'),
      longitude: data.get('longitude'),
    });
    if (!parsed.success) {
      setError(copy.invalid);
      return;
    }
    selectPoint(parsed.data);
    setError('');
  }

  function locate() {
    if (!navigator.geolocation) {
      setError(copy.locationError);
      return;
    }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        selectPoint({ latitude: coords.latitude, longitude: coords.longitude });
        setLocating(false);
      },
      () => {
        setError(copy.locationError);
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }

  return (
    <ModePanel
      ref={panel}
      id="place-controls"
      className={styles.panel}
      title={copy.title}
      expandLabel={copy.show}
      collapseLabel={copy.hide}
      headerActions={
        <button
          type="button"
          className={styles.flip}
          onClick={() => requestCameraFocus(antipodeOf(point))}
        >
          {copy.flip} <span aria-hidden="true">↗</span>
        </button>
      }
    >
      <>
        <label className={styles.search}>
          <span>{copy.search}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
            autoComplete="off"
          />
        </label>
        {results.length > 0 ? (
          <ul className={styles.results} aria-label={copy.search}>
            {results.map((city) => (
              <li key={city.id}>
                <button type="button" onClick={() => chooseCity(city)}>
                  <strong>{city.name[locale]}</strong>
                  <span>{city.country[locale]}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <form
          key={`${point.latitude},${point.longitude}`}
          className={styles.coordinates}
          onSubmit={submitCoordinates}
        >
          <span>{copy.coordinates}</span>
          <label>
            <span>{copy.latitude}</span>
            <input
              name="latitude"
              inputMode="decimal"
              defaultValue={point.latitude.toFixed(4)}
            />
          </label>
          <label>
            <span>{copy.longitude}</span>
            <input
              name="longitude"
              inputMode="decimal"
              defaultValue={point.longitude.toFixed(4)}
            />
          </label>
          <button type="submit">{copy.apply}</button>
        </form>

        <div className={styles.secondary}>
          <button type="button" onClick={locate} disabled={locating}>
            {locating ? copy.locating : copy.locate}
          </button>
          <div className={styles.examples} aria-label={copy.examples}>
            <span>{copy.examples}</span>
            {examples.map((city) => (
              <button
                key={city.id}
                type="button"
                onClick={() => chooseCity(city)}
              >
                {city.name[locale]}
              </button>
            ))}
          </div>
        </div>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <details className={styles.method}>
          <summary>{copy.method}</summary>
          <p>{copy.methodText}</p>
          <p>{copy.attribution}</p>
          <a
            href="https://www.naturalearthdata.com/"
            target="_blank"
            rel="noreferrer"
          >
            {copy.source} ↗
          </a>
          {' · '}
          <a
            href="https://www.naturalearthdata.com/about/terms-of-use/"
            target="_blank"
            rel="noreferrer"
          >
            {copy.terms} ↗
          </a>
        </details>
      </>
    </ModePanel>
  );
}
