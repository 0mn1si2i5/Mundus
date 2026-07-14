import {
  Component,
  lazy,
  Suspense,
  type ErrorInfo,
  type ReactNode,
  useMemo,
  useState,
} from 'react';
import { antipodeOf } from '../features/globe/geo';
import {
  chordDistanceKm,
  surfaceDistanceKm,
} from '../features/antipodes/distance';
import { useNearestPopulatedPlace } from '../features/antipodes/populatedPlaces';
import { MODE_DEFINITIONS } from '../features/modes/modeRegistry';
import { ShareDialog } from '../features/share/ShareDialog';
import { useAppStore } from '../state/appStore';
import { useUrlState } from './useUrlState';
import { messages } from '../i18n/messages';
import {
  developmentColor,
  valuesByCountryId,
} from '../features/development/developmentData';
import { useDevelopmentDataset } from '../features/development/useDevelopmentDataset';
import styles from './App.module.css';

const GlobeViewport = lazy(() =>
  import('../features/globe/GlobeViewport').then((module) => ({
    default: module.GlobeViewport,
  })),
);

const OtherSideControls = lazy(() =>
  import('../features/antipodes/OtherSideControls').then((module) => ({
    default: module.OtherSideControls,
  })),
);

const DevelopmentControls = lazy(() =>
  import('../features/development/DevelopmentControls').then((module) => ({
    default: module.DevelopmentControls,
  })),
);

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Globe viewport failed', error, info);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function App() {
  const [shareOpen, setShareOpen] = useState(false);
  const locale = useAppStore((state) => state.locale);
  const activeMode = useAppStore((state) => state.activeMode);
  const point = useAppStore((state) => state.point);
  const developmentIndicator = useAppStore(
    (state) => state.developmentIndicator,
  );
  const developmentYear = useAppStore((state) => state.developmentYear);
  const selectedCountry = useAppStore((state) => state.selectedCountry);
  const antipodeCountry = useAppStore((state) => state.antipodeCountry);
  const hoveredCountry = useAppStore((state) => state.hoveredCountry);
  const selectMode = useAppStore((state) => state.selectMode);
  const setLocale = useAppStore((state) => state.setLocale);
  const t = messages[locale];
  const mode = MODE_DEFINITIONS[activeMode];
  const antipode = antipodeOf(point);
  const nearestPlace = useNearestPopulatedPlace(
    antipode,
    activeMode === 'antipodes',
  );
  const developmentData = useDevelopmentDataset(activeMode === 'development');
  const developmentFills = useMemo(() => {
    if (developmentData.status !== 'ready') return null;
    return new Map(
      [
        ...valuesByCountryId(
          developmentData.data,
          developmentIndicator,
          developmentYear,
        ),
      ].map(([countryId, value]) => [countryId, developmentColor(value)]),
    );
  }, [developmentData, developmentIndicator, developmentYear]);
  const numberFormatter = new Intl.NumberFormat(
    locale === 'zh' ? 'zh-CN' : 'en-US',
    {
      maximumFractionDigits: 0,
    },
  );
  useUrlState();

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <a className={styles.brand} href="./" aria-label="Mundus home">
            MUNDUS
          </a>
          <p className={styles.eyebrow}>{t.laboratory}</p>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.textButton}
            type="button"
            onClick={() => setShareOpen(true)}
          >
            {t.share}
          </button>
          <button
            className={styles.languageButton}
            type="button"
            onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
            aria-label={t.changeLanguage}
          >
            {locale === 'zh' ? 'EN' : '中'}
          </button>
        </div>
      </header>

      <section
        className={styles.intro}
        data-mode={activeMode}
        aria-labelledby="mode-title"
      >
        <p className={styles.index}>
          0{Object.keys(MODE_DEFINITIONS).indexOf(activeMode) + 1} / 03
        </p>
        <h1 id="mode-title">{mode.title[locale]}</h1>
        <p>{mode.question[locale]}</p>
      </section>

      <ErrorBoundary fallback={<GlobeFallback label={t.fallback} />}>
        <Suspense fallback={<GlobeFallback label={t.loadingGlobe} />}>
          <GlobeViewport
            fallbackLabel={t.fallback}
            contextLostLabel={t.contextLost}
            ariaLabel={t.globeLabel}
            keyboardInstructions={t.globeKeyboard}
            keyboardMovedLabel={t.globeMoved}
            keyboardZoomedLabel={t.globeZoomed}
            keyboardSelectedLabel={t.globeSelected}
            countryFills={developmentFills}
            showAntipodes={activeMode === 'antipodes'}
          />
        </Suspense>
      </ErrorBoundary>

      {activeMode === 'antipodes' ? (
        <aside
          className={styles.result}
          aria-live="polite"
          aria-label={t.result}
        >
          <span>{t.selectedPoint}</span>
          <em>{selectedCountry?.name ?? t.openOcean}</em>
          <strong>
            {point.latitude.toFixed(4)}°, {point.longitude.toFixed(4)}°
          </strong>
          <div className={styles.rule} />
          <span>{t.antipode}</span>
          <em>{antipodeCountry?.name ?? t.openOcean}</em>
          <strong>
            {antipode.latitude.toFixed(4)}°, {antipode.longitude.toFixed(4)}°
          </strong>
          {nearestPlace.status !== 'idle' ? (
            <div className={styles.nearestPlace}>
              <span>{t.nearestPlace}</span>
              {nearestPlace.status === 'ready' ? (
                <>
                  <em>
                    {nearestPlace.result.place.name},{' '}
                    {nearestPlace.result.place.country}
                  </em>
                  <strong>
                    {t.nearestPlaceDistance}{' '}
                    {numberFormatter.format(nearestPlace.result.distanceKm)} km
                  </strong>
                  <small>{t.nearestPlaceScope}</small>
                </>
              ) : (
                <strong>
                  {nearestPlace.status === 'loading'
                    ? t.nearestPlaceLoading
                    : t.nearestPlaceUnavailable}
                </strong>
              )}
            </div>
          ) : null}
          <div className={styles.distanceRow}>
            <span>{t.coreDistance}</span>
            <strong>
              {numberFormatter.format(chordDistanceKm(point, antipode))} km
            </strong>
            <span>{t.surfaceDistance}</span>
            <strong>
              {numberFormatter.format(surfaceDistanceKm(point, antipode))} km
            </strong>
          </div>
        </aside>
      ) : null}

      {hoveredCountry ? (
        <p className={styles.hoverLabel}>{hoveredCountry.name}</p>
      ) : null}

      {activeMode === 'antipodes' ? (
        <Suspense fallback={null}>
          <OtherSideControls locale={locale} />
        </Suspense>
      ) : null}

      {activeMode === 'development' ? (
        <Suspense fallback={null}>
          <DevelopmentControls
            locale={locale}
            loadState={developmentData}
            selectedCountry={selectedCountry}
          />
        </Suspense>
      ) : null}

      <nav className={styles.modeNav} aria-label={t.modes}>
        {Object.values(MODE_DEFINITIONS).map((item, index) => (
          <button
            key={item.id}
            className={item.id === activeMode ? styles.activeMode : undefined}
            type="button"
            onClick={() => selectMode(item.id)}
            aria-current={item.id === activeMode ? 'page' : undefined}
          >
            <span>0{index + 1}</span>
            {item.title[locale]}
          </button>
        ))}
      </nav>

      <p className={styles.hint}>{t.hint}</p>
      {shareOpen ? (
        <ShareDialog locale={locale} onClose={() => setShareOpen(false)} />
      ) : null}
    </main>
  );
}

function GlobeFallback({ label }: { label: string }) {
  return (
    <section className={styles.fallback} role="img" aria-label={label}>
      <div />
      <p>{label}</p>
    </section>
  );
}
