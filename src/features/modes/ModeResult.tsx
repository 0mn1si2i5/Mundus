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
      const nearestResult =
        presentation.nearestPlace.status === 'ready'
          ? presentation.nearestPlace.result
          : null;
      return (
        <aside
          className={styles.result}
          aria-live="polite"
          aria-label={t.result}
        >
          <span>{t.selectedPoint}</span>
          <em>{presentation.selectedCountry?.name ?? t.openOcean}</em>
          <strong>
            {presentation.point.latitude.toFixed(4)}°,{' '}
            {presentation.point.longitude.toFixed(4)}°
          </strong>
          <div className={styles.rule} />
          <span>{t.antipode}</span>
          <em>{presentation.antipodeCountry?.name ?? t.openOcean}</em>
          <strong>
            {presentation.antipode.latitude.toFixed(4)}°,{' '}
            {presentation.antipode.longitude.toFixed(4)}°
          </strong>
          {presentation.nearestPlace.status !== 'idle' ? (
            <div className={styles.nearestPlace}>
              <span>{t.nearestPlace}</span>
              {nearestResult ? (
                <>
                  <button
                    type="button"
                    className={styles.nearestPlaceButton}
                    onClick={() => onCameraFocus(nearestResult.place.point)}
                  >
                    <em>
                      {nearestResult.place.name}, {nearestResult.place.country}
                    </em>
                    <span>{t.focusNearestPlace}</span>
                  </button>
                  <strong>
                    {t.nearestPlaceDistance}{' '}
                    {numberFormatter.format(nearestResult.distanceKm)} km
                  </strong>
                  <small>{t.nearestPlaceScope}</small>
                </>
              ) : (
                <strong>
                  {presentation.nearestPlace.status === 'loading'
                    ? t.nearestPlaceLoading
                    : t.nearestPlaceUnavailable}
                </strong>
              )}
            </div>
          ) : null}
          <div className={styles.distanceRow}>
            <span>{t.coreDistance}</span>
            <strong>
              {numberFormatter.format(
                chordDistanceKm(presentation.point, presentation.antipode),
              )}{' '}
              km
            </strong>
            <span>{t.surfaceDistance}</span>
            <strong>
              {numberFormatter.format(
                surfaceDistanceKm(presentation.point, presentation.antipode),
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

function formatUtcEvent(timestampMs: number): string {
  return `${new Date(timestampMs).toISOString().slice(5, 16).replace('T', ' ')} UTC`;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled result: ${String(value)}`);
}
