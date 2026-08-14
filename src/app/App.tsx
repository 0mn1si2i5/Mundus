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
import { ExhibitLobby } from '../features/modes/ExhibitLobby';
import { ModePreview } from '../features/modes/ModePreview';
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
  const previewMode = useAppStore((state) => state.previewMode);
  const point = useAppStore((state) => state.point);
  const hoveredCountry = useAppStore((state) => state.hoveredCountry);
  const selectMode = useAppStore((state) => state.selectMode);
  const openModePreview = useAppStore((state) => state.openModePreview);
  const closeModePreview = useAppStore((state) => state.closeModePreview);
  const enterPreviewMode = useAppStore((state) => state.enterPreviewMode);
  const exitMode = useAppStore((state) => state.exitMode);
  const navigationNotice = useAppStore((state) => state.navigationNotice);
  const dismissNavigationNotice = useAppStore(
    (state) => state.dismissNavigationNotice,
  );
  const requestCameraFocus = useAppStore((state) => state.requestCameraFocus);
  const setLocale = useAppStore((state) => state.setLocale);
  const t = messages[locale];
  const presentation = useModePresentation();
  useUrlState();
  useCountrySelection();

  function previewFromAtlas(selectedMode: ModeId) {
    openModePreview(selectedMode);
    setAtlasOpen(false);
  }

  function enterFromPreview() {
    enterPreviewMode();
    window.requestAnimationFrame(() => {
      document.getElementById('mode-title')?.focus();
    });
  }

  function returnToLobby() {
    exitMode();
    window.requestAnimationFrame(() => {
      document.getElementById('lobby-heading')?.focus();
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
      {navigationNotice ? (
        <div className={styles.notice} role="status">
          <p>{t.unknownModeNotice}</p>
          <button
            type="button"
            onClick={dismissNavigationNotice}
            aria-label={t.dismissNotice}
          >
            ×
          </button>
        </div>
      ) : null}
      <div className={styles.stage} data-testid="app-stage">
        <header className={styles.header}>
          <div>
            <a
              className={styles.brand}
              href="./"
              aria-label="Mundus home"
              onClick={(event) => {
                if (activeMode !== null) {
                  event.preventDefault();
                  returnToLobby();
                }
              }}
            >
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

        {presentation === null ? (
          <ExhibitLobby locale={locale} onSelectPreview={openModePreview} />
        ) : (
          <section
            key={presentation.id}
            className={styles.intro}
            data-mode={presentation.id}
            aria-labelledby="mode-title"
          >
            <p className={styles.index}>
              0{modeIndex(presentation.id) + 1} / 0{MODE_ORDER.length}
            </p>
            <h1 id="mode-title" tabIndex={-1}>
              {locale === 'zh'
                ? MODE_DEFINITIONS[presentation.id].titlePhrases.zh.map(
                    (phrase, index) => (
                      <span key={phrase}>
                        {index > 0 ? <wbr /> : null}
                        <span
                          className={styles.titlePhrase}
                          data-title-phrase
                        >
                          {phrase}
                        </span>
                      </span>
                    ),
                  )
                : MODE_DEFINITIONS[presentation.id].title.en}
            </h1>
            <p>{MODE_DEFINITIONS[presentation.id].question[locale]}</p>
          </section>
        )}

        <ErrorBoundary
          resetKey={activeMode ?? 'lobby'}
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
              diagnosticResetKey={`${activeMode ?? 'lobby'}:${point.latitude},${point.longitude}`}
              fallbackLabel={t.fallback}
              contextLostLabel={t.contextLost}
              ariaLabel={t.globeLabel}
              keyboardInstructions={t.globeKeyboard}
              keyboardMovedLabel={t.globeMoved}
              keyboardZoomedLabel={t.globeZoomed}
              keyboardSelectedLabel={t.globeSelected}
              countryFills={presentation?.globe.countryFills ?? null}
              showAntipodes={presentation?.globe.showAntipodes ?? false}
              sunline={presentation?.globe.sunline ?? null}
              antipodeRelation={presentation?.globe.antipodeRelation ?? null}
            />
          </Suspense>
        </ErrorBoundary>
      </div>

      {presentation ? (
        <>
          {MODE_DEFINITIONS[presentation.id].curation === 'archived' ? (
            <div className={styles.notice} role="status">
              <p>{t.archiveNotice}</p>
            </div>
          ) : null}
          <ModeResult
            locale={locale}
            presentation={presentation}
            onCameraFocus={requestCameraFocus}
          />

          {hoveredCountry ? (
            <p className={styles.hoverLabel}>{hoveredCountry.name}</p>
          ) : null}

          <ModeBoundary
            mode={presentation.id}
            label={t.componentFailed}
            retry={t.retry}
          >
            <ModeControls locale={locale} presentation={presentation} />
          </ModeBoundary>

          <nav className={styles.modeNav} aria-label={t.modes}>
            {MODE_ORDER.map((modeId, index) => {
              const item = MODE_DEFINITIONS[modeId];
              return (
                <button
                  key={item.id}
                  className={
                    item.id === presentation.id
                      ? styles.activeMode
                      : undefined
                  }
                  type="button"
                  onClick={() => selectMode(item.id)}
                  aria-current={
                    item.id === presentation.id ? 'page' : undefined
                  }
                >
                  <span className={styles.modeNavIndex}>0{index + 1}</span>
                  <span className={styles.modeNavTitle}>
                    {item.title[locale]}
                  </span>
                </button>
              );
            })}
          </nav>
        </>
      ) : null}

      <FirstInteractionHint locale={locale} />
      {shareOpen ? (
        <ShareDialog locale={locale} onClose={() => setShareOpen(false)} />
      ) : null}
      {atlasOpen ? (
        <ModeAtlas
          locale={locale}
          activeMode={activeMode}
          onSelectMode={previewFromAtlas}
          onClose={() => setAtlasOpen(false)}
        />
      ) : null}
      {previewMode ? (
        <ModePreview
          locale={locale}
          modeId={previewMode}
          onClose={closeModePreview}
          onEnter={enterFromPreview}
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
