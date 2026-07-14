import {
  Component,
  lazy,
  Suspense,
  type ErrorInfo,
  type ReactNode,
  useState,
} from 'react';
import { antipodeOf } from '../features/globe/geo';
import {
  chordDistanceKm,
  surfaceDistanceKm,
} from '../features/antipodes/distance';
import { MODE_DEFINITIONS } from '../features/modes/modeRegistry';
import { ShareDialog } from '../features/share/ShareDialog';
import { useAppStore } from '../state/appStore';
import { useUrlState } from './useUrlState';
import { messages } from '../i18n/messages';
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
  const selectedCountry = useAppStore((state) => state.selectedCountry);
  const antipodeCountry = useAppStore((state) => state.antipodeCountry);
  const hoveredCountry = useAppStore((state) => state.hoveredCountry);
  const selectMode = useAppStore((state) => state.selectMode);
  const setLocale = useAppStore((state) => state.setLocale);
  const t = messages[locale];
  const mode = MODE_DEFINITIONS[activeMode];
  const antipode = antipodeOf(point);
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

      <section className={styles.intro} aria-labelledby="mode-title">
        <p className={styles.index}>01 / 03</p>
        <h1 id="mode-title">{mode.title[locale]}</h1>
        <p>{mode.question[locale]}</p>
      </section>

      <ErrorBoundary fallback={<GlobeFallback label={t.fallback} />}>
        <Suspense fallback={<GlobeFallback label={t.loadingGlobe} />}>
          <GlobeViewport
            fallbackLabel={t.fallback}
            contextLostLabel={t.contextLost}
          />
        </Suspense>
      </ErrorBoundary>

      <aside className={styles.result} aria-live="polite" aria-label={t.result}>
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

      {hoveredCountry ? (
        <p className={styles.hoverLabel}>{hoveredCountry.name}</p>
      ) : null}

      {activeMode === 'antipodes' ? (
        <Suspense fallback={null}>
          <OtherSideControls locale={locale} />
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
