import { useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import type { Locale } from '../../i18n/messages';
import { useAppStore } from '../../state/appStore';
import { ModePanel, type ModePanelHandle } from '../controls/ModePanel';
import { FEATURED_CITIES } from './cities';
import type { GeoPoint } from '../globe/geo';
import { CityAutocomplete } from './CityAutocomplete';
import type { GeoNamesCityLoadState } from './useGeoNamesCityIndex';
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
    coordinates: '坐标',
    latitude: '纬度',
    longitude: '经度',
    apply: '前往',
    locate: '使用我的位置',
    locating: '正在定位…',
    locationError: '无法读取位置，请检查浏览器权限。',
    invalid: '纬度需在 ±90°、经度需在 ±180° 内。',
    viewAntipode: '翻到对跖点',
    returnOrigin: '返回起点',
    examples: '精选起点',
    method: '数据与方法',
    methodText:
      '对跖点通过纬度取反并将经度旋转 180° 计算。端点附近的实线贴合地表，虚线表示穿过不透明地球内部的剖面，并不表示地球透明。双侧最近主要城市与搜索共用 GeoNames 固定快照；城市结果仅限符合条件的收录项，并非最近聚居地、行政边界或建成区。国家或海洋判断使用 Natural Earth 110m；边界是制图表达，不是领土法律权威。',
    attribution: 'Made with Natural Earth · 公共领域数据',
    source: 'Natural Earth 来源',
    terms: '使用条款',
    geoNamesAttribution: '包含 GeoNames 数据 · CC BY 4.0 · 不提供任何保证',
    geoNamesSource: 'GeoNames 来源',
    geoNamesLicense: 'GeoNames CC BY 4.0 许可',
    show: '展开地点控件',
    hide: '收起地点控件',
  },
  en: {
    title: 'Choose a starting point',
    coordinates: 'Coordinates',
    latitude: 'Latitude',
    longitude: 'Longitude',
    apply: 'Go',
    locate: 'Use my location',
    locating: 'Locating…',
    locationError: 'Location is unavailable. Check browser permission.',
    invalid: 'Latitude must be within ±90° and longitude within ±180°.',
    viewAntipode: 'View antipode',
    returnOrigin: 'Return to origin',
    examples: 'Featured starts',
    method: 'Data and method',
    methodText:
      'The antipode negates latitude and rotates longitude by 180°. Solid endpoint pieces hug the surface; the dashed line denotes a section through the opaque Earth, not a transparent globe. Bilateral nearest-major-city results and search share one fixed GeoNames snapshot; city results are limited to eligible indexed entries, not nearest settlements, administrative boundaries, or built areas. Country or ocean lookup uses Natural Earth 110m; boundaries are a cartographic view, not a legal authority on territorial status.',
    attribution: 'Made with Natural Earth · public domain data',
    source: 'Natural Earth source',
    terms: 'Terms of use',
    geoNamesAttribution: 'Contains GeoNames data · CC BY 4.0 · no warranty',
    geoNamesSource: 'GeoNames source',
    geoNamesLicense: 'GeoNames CC BY 4.0 license',
    show: 'Expand place controls',
    hide: 'Collapse place controls',
  },
} as const;

export function OtherSideControls({
  locale,
  cityIndex,
}: {
  locale: Locale;
  cityIndex: GeoNamesCityLoadState;
}) {
  const point = useAppStore((state) => state.point);
  const selectPoint = useAppStore((state) => state.selectPoint);
  const cameraSide = useAppStore((state) => state.cameraFocusIntent.side);
  const toggleAntipodeFocus = useAppStore((state) => state.toggleAntipodeFocus);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const panel = useRef<ModePanelHandle>(null);
  const copy = COPY[locale];

  function choosePoint(selectedPoint: GeoPoint) {
    selectPoint(selectedPoint);
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
          onClick={toggleAntipodeFocus}
        >
          {cameraSide === 'antipode' ? copy.returnOrigin : copy.viewAntipode}{' '}
          <span aria-hidden="true">↗</span>
        </button>
      }
    >
      <>
        <CityAutocomplete
          locale={locale}
          loadState={cityIndex}
          onSelect={(city) => choosePoint(city.point)}
        />

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
            {FEATURED_CITIES.map((city) => (
              <button
                key={city.id}
                type="button"
                onClick={() => choosePoint(city.point)}
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
          <p>{copy.geoNamesAttribution}</p>
          <a
            href="https://www.naturalearthdata.com/"
            target="_blank"
            rel="noreferrer"
          >
            {copy.source} ↗
          </a>
          {' · '}
          <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
            {copy.geoNamesSource} ↗
          </a>
          {' · '}
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noreferrer"
          >
            {copy.geoNamesLicense} ↗
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
