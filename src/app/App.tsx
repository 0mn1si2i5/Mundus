import {
  Component,
  lazy,
  Suspense,
  type ErrorInfo,
  type ReactNode,
  useEffect,
  useState,
} from 'react';
import {
  MODE_DEFINITIONS,
  MODE_ORDER,
  modeIndex,
  type ModeId,
} from '../features/modes/modeRegistry';
import { ModeAtlas } from '../features/modes/ModeAtlas';
import { ModeControls } from '../features/modes/ModeControls';
import { ModeResult } from '../features/modes/ModeResult';
import { useModePresentation } from '../features/modes/useModePresentation';
import { FirstInteractionHint } from '../features/discovery/FirstInteractionHint';
import { ShareDialog } from '../features/share/ShareDialog';
import { useAppStore } from '../state/appStore';
import { useUrlState } from './useUrlState';
import { messages } from '../i18n/messages';
import styles from './App.module.css';
import { useCountrySelection } from '../features/globe/useCountrySelection';

const GlobeViewport = lazy(() =>
  import('../features/globe/GlobeViewport').then((module) => ({
    default: module.GlobeViewport,
  })),
);

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  resetKey: string;
  scope: string;
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
    console.error(`${this.props.scope} failed`, error, info);
  }

  componentDidUpdate(previous: ErrorBoundaryProps) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function App() {
  const [shareOpen, setShareOpen] = useState(false);
  const [atlasOpen, setAtlasOpen] = useState(false);
  const locale = useAppStore((state) => state.locale);
  const activeMode = useAppStore((state) => state.activeMode);
  const hoveredCountry = useAppStore((state) => state.hoveredCountry);
  const selectMode = useAppStore((state) => state.selectMode);
  const setLocale = useAppStore((state) => state.setLocale);
  const t = messages[locale];
  const mode = MODE_DEFINITIONS[activeMode];
  const presentation = useModePresentation();
  useUrlState();
  useCountrySelection();

  function chooseModeFromAtlas(selectedMode: ModeId) {
    selectMode(selectedMode);
    setAtlasOpen(false);
    window.requestAnimationFrame(() => {
      document.getElementById('mode-title')?.focus();
    });
  }

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    document.title =
      locale === 'zh'
        ? 'Mundus · 交互式三维地球实验室'
        : 'Mundus · Interactive terrestrial laboratory';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        locale === 'zh'
          ? 'Mundus — 用不同的观察方式重新认识地球。'
          : 'Mundus — See Earth again through different ways of observing.',
      );
  }, [locale]);

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
            onClick={() => {
              setShareOpen(false);
              setAtlasOpen(true);
            }}
          >
            {t.modeAtlas}
          </button>
          <button
            className={styles.textButton}
            type="button"
            onClick={() => {
              setAtlasOpen(false);
              setShareOpen(true);
            }}
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
        key={activeMode}
        className={styles.intro}
        data-mode={activeMode}
        aria-labelledby="mode-title"
      >
        <p className={styles.index}>
          0{modeIndex(activeMode) + 1} / 0{MODE_ORDER.length}
        </p>
        <h1 id="mode-title" tabIndex={-1}>
          {mode.title[locale]}
        </h1>
        <p>{mode.question[locale]}</p>
      </section>

      <ErrorBoundary
        resetKey={activeMode}
        scope="Globe viewport"
        fallback={
          <RecoverableFallback
            label={t.componentFailed}
            retryLabel={t.retry}
            globe
          />
        }
      >
        <Suspense fallback={<GlobeFallback label={t.loadingGlobe} />}>
          <GlobeViewport
            fallbackLabel={t.fallback}
            contextLostLabel={t.contextLost}
            ariaLabel={t.globeLabel}
            keyboardInstructions={t.globeKeyboard}
            keyboardMovedLabel={t.globeMoved}
            keyboardZoomedLabel={t.globeZoomed}
            keyboardSelectedLabel={t.globeSelected}
            countryFills={presentation.globe.countryFills}
            showAntipodes={presentation.globe.showAntipodes}
            sunline={presentation.globe.sunline}
          />
        </Suspense>
      </ErrorBoundary>

      <ModeResult locale={locale} presentation={presentation} />

      {hoveredCountry ? (
        <p className={styles.hoverLabel}>{hoveredCountry.name}</p>
      ) : null}

      <ModeBoundary mode={activeMode} label={t.componentFailed} retry={t.retry}>
        <ModeControls locale={locale} presentation={presentation} />
      </ModeBoundary>

      <nav className={styles.modeNav} aria-label={t.modes}>
        {MODE_ORDER.map((modeId, index) => {
          const item = MODE_DEFINITIONS[modeId];
          return (
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
          );
        })}
      </nav>

      <FirstInteractionHint locale={locale} />
      {shareOpen ? (
        <ShareDialog locale={locale} onClose={() => setShareOpen(false)} />
      ) : null}
      {atlasOpen ? (
        <ModeAtlas
          locale={locale}
          activeMode={activeMode}
          onSelectMode={chooseModeFromAtlas}
          onClose={() => setAtlasOpen(false)}
        />
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

function ModeBoundary({
  mode,
  label,
  retry,
  children,
}: {
  mode: string;
  label: string;
  retry: string;
  children: ReactNode;
}) {
  return (
    <ErrorBoundary
      resetKey={mode}
      scope={`${mode} controls`}
      fallback={<RecoverableFallback label={label} retryLabel={retry} />}
    >
      {children}
    </ErrorBoundary>
  );
}

function RecoverableFallback({
  label,
  retryLabel,
  globe = false,
}: {
  label: string;
  retryLabel: string;
  globe?: boolean;
}) {
  return (
    <section
      className={globe ? styles.recoverableGlobe : styles.recoverableMode}
      role="alert"
    >
      <p>{label}</p>
      <button type="button" onClick={() => window.location.reload()}>
        {retryLabel}
      </button>
    </section>
  );
}
