import type { Locale } from '../../i18n/messages';
import { messages } from '../../i18n/messages';
import { chordDistanceKm, surfaceDistanceKm } from '../antipodes/distance';
import type { ModePresentation } from './useModePresentation';
import styles from './ModeResult.module.css';
import type { GeoPoint } from '../globe/geo';

export function ModeResult({
  locale,
  presentation,
  onCameraFocus,
}: {
  locale: Locale;
  presentation: ModePresentation;
  onCameraFocus: (point: GeoPoint) => void;
}) {
  const t = messages[locale];
  switch (presentation.id) {
    case 'antipodes': {
      const numberFormatter = new Intl.NumberFormat(
        locale === 'zh' ? 'zh-CN' : 'en-US',
        { maximumFractionDigits: 0 },
      );
      const relation = presentation.relation;
      return (
        <aside
          className={styles.result}
          aria-live="polite"
          aria-label={t.result}
        >
          <div className={styles.relationSides}>
            <RelationSide
              exactLabel={t.selectedPoint}
              country={presentation.selectedCountry?.name ?? t.openOcean}
              point={relation.origin.exactPoint}
              cityLabel={t.originMajorCity}
              cityDisplayLabel={t.nearestRepresentedMajorCity}
              side={relation.origin}
              locale={locale}
              distanceLabel={t.distanceFromExactPoint}
              focusLabel={t.focusMajorCity}
              numberFormatter={numberFormatter}
              onCameraFocus={onCameraFocus}
            />
            <RelationSide
              exactLabel={t.antipode}
              country={presentation.antipodeCountry?.name ?? t.openOcean}
              point={relation.antipode.exactPoint}
              cityLabel={t.antipodeMajorCity}
              cityDisplayLabel={t.nearestRepresentedMajorCity}
              side={relation.antipode}
              locale={locale}
              distanceLabel={t.distanceFromExactPoint}
              focusLabel={t.focusMajorCity}
              numberFormatter={numberFormatter}
              onCameraFocus={onCameraFocus}
            />
          </div>
          {relation.origin.nearestMajorCity &&
          relation.antipode.nearestMajorCity ? (
            <div className={styles.relationScope}>
              <small>{t.majorCityScope}</small>
              <small>{t.geoNamesAttribution}</small>
            </div>
          ) : (
            <strong data-testid="antipode-relation-status">
              {presentation.relationStatus === 'error'
                ? t.majorCitiesUnavailable
                : t.majorCitiesLoading}
            </strong>
          )}
          <div className={styles.distanceRow}>
            <span>{t.coreDistance}</span>
            <strong>
              {numberFormatter.format(
                chordDistanceKm(
                  relation.origin.exactPoint,
                  relation.antipode.exactPoint,
                ),
              )}{' '}
              km
            </strong>
            <span>{t.surfaceDistance}</span>
            <strong>
              {numberFormatter.format(
                surfaceDistanceKm(
                  relation.origin.exactPoint,
                  relation.antipode.exactPoint,
                ),
              )}{' '}
              km
            </strong>
          </div>
        </aside>
      );
    }
    case 'development':
      return null;
    case 'sunline':
      return (
        <aside
          className={`${styles.result} ${styles.sunlineResult}`}
          aria-live="polite"
          aria-label={t.sunlineResult}
        >
          <span>{t.selectedPoint}</span>
          <em>{presentation.selectedCountry?.name ?? t.openOcean}</em>
          <strong>
            {presentation.point.latitude.toFixed(2)}°,{' '}
            {presentation.point.longitude.toFixed(2)}°
          </strong>
          <div className={styles.rule} />
          <span>{t.solarAltitude}</span>
          <strong>
            {presentation.sun.observation.altitudeDegrees.toFixed(1)}°
          </strong>
          <span>{t.daylightState}</span>
          <em>
            {presentation.sun.observation.daylight === 'day'
              ? t.daylightDay
              : presentation.sun.observation.daylight === 'civil-twilight'
                ? t.daylightTwilight
                : t.daylightNight}
          </em>
          {presentation.sun.events.status === 'normal' ? (
            <div className={styles.distanceRow}>
              <span>{t.sunrise}</span>
              <strong>
                {formatUtcEvent(presentation.sun.events.sunriseMs)}
              </strong>
              <span>{t.sunset}</span>
              <strong>
                {formatUtcEvent(presentation.sun.events.sunsetMs)}
              </strong>
            </div>
          ) : (
            <strong className={styles.polarState}>
              {presentation.sun.events.status === 'polar-day'
                ? t.polarDay
                : t.polarNight}
            </strong>
          )}
          <div className={styles.subsolar}>
            <span>{t.subsolarPoint}</span>
            <strong>
              {presentation.sun.position.subsolarPoint.latitude.toFixed(2)}°,{' '}
              {presentation.sun.position.subsolarPoint.longitude.toFixed(2)}°
            </strong>
          </div>
        </aside>
      );
    default:
      return assertNever(presentation);
  }
}

function RelationSide({
  exactLabel,
  country,
  point,
  cityLabel,
  cityDisplayLabel,
  side,
  locale,
  distanceLabel,
  focusLabel,
  numberFormatter,
  onCameraFocus,
}: {
  exactLabel: string;
  country: string;
  point: GeoPoint;
  cityLabel: string;
  cityDisplayLabel: string;
  side: import('../antipodes/relation').AntipodeRelationSide | null;
  locale: Locale;
  distanceLabel: string;
  focusLabel: string;
  numberFormatter: Intl.NumberFormat;
  onCameraFocus: (point: GeoPoint) => void;
}) {
  return (
    <section className={styles.relationSide}>
      <span>{exactLabel}</span>
      <em>{country}</em>
      <strong>
        {point.latitude.toFixed(4)}°, {point.longitude.toFixed(4)}°
      </strong>
      {side?.nearestMajorCity ? (
        <div
          className={styles.cityRelation}
          role="region"
          aria-label={cityLabel}
        >
          <span>{cityDisplayLabel}</span>
          <button
            type="button"
            className={styles.nearestPlaceButton}
            onClick={() => onCameraFocus(side.nearestMajorCity!.city.point)}
          >
            <em>{side.nearestMajorCity.city.name[locale]}</em>
            <span>{focusLabel}</span>
          </button>
          <strong>
            {[
              side.nearestMajorCity.city.admin1?.[locale],
              side.nearestMajorCity.city.country[locale],
            ]
              .filter(Boolean)
              .join(', ')}
          </strong>
          <strong>
            {distanceLabel}{' '}
            {numberFormatter.format(side.nearestMajorCity.distanceKm)} km
          </strong>
        </div>
      ) : null}
    </section>
  );
}

function formatUtcEvent(timestampMs: number): string {
  return `${new Date(timestampMs).toISOString().slice(5, 16).replace('T', ' ')} UTC`;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled result: ${String(value)}`);
}
