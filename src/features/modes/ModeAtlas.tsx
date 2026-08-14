import { createPortal } from 'react-dom';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import type { Locale } from '../../i18n/messages';
import { messages } from '../../i18n/messages';
import {
  archivedModes,
  defaultVisibleModes,
  featuredModes,
  filterModesByTags,
  MODE_TAGS,
  type ModeId,
  type ModeTag,
} from './modeRegistry';
import styles from './ModeAtlas.module.css';

type AtlasView = 'featured' | 'new' | 'all' | 'archived';

const VIEWS: AtlasView[] = ['featured', 'new', 'all', 'archived'];

const VIEW_LABEL = {
  featured: 'atlasFeatured',
  new: 'atlasNew',
  all: 'atlasAll',
  archived: 'atlasArchived',
} as const;

const TAG_LABEL = {
  place: 'tagPlace',
  time: 'tagTime',
  humanity: 'tagHumanity',
  nature: 'tagNature',
} as const;

export function ModeAtlas({
  locale,
  activeMode,
  onSelectMode,
  onClose,
}: {
  locale: Locale;
  activeMode: ModeId | null;
  onSelectMode: (mode: ModeId) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(true);
  const [view, setView] = useState<AtlasView>('featured');
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState<ModeTag[]>([]);
  const t = messages[locale];

  useEffect(() => {
    const previousFocus = document.activeElement;
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    closeButton.current?.focus();
    return () => {
      root?.removeAttribute('inert');
      if (restoreFocus.current && previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
  }, []);

  const base = useMemo(() => {
    switch (view) {
      case 'featured':
        return featuredModes();
      case 'new':
        return defaultVisibleModes().filter(
          (mode) => mode.maturity === 'experimental',
        );
      case 'all':
        return defaultVisibleModes();
      case 'archived':
        return archivedModes();
    }
  }, [view]);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    const searched =
      needle === ''
        ? base
        : base.filter((mode) =>
            [mode.title[locale], mode.question[locale], mode.summary[locale]]
              .join(' ')
              .toLocaleLowerCase(locale)
              .includes(needle),
          );
    return filterModesByTags(searched, tags);
  }, [base, query, tags, locale]);

  function toggleTag(tag: ModeTag) {
    setTags((previous) =>
      previous.includes(tag)
        ? previous.filter((item) => item !== tag)
        : [...previous, tag],
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = dialog.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled])',
    );
    const first = controls?.[0];
    const last = controls?.[controls.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function selectMode(modeId: ModeId) {
    restoreFocus.current = false;
    onSelectMode(modeId);
  }

  return createPortal(
    <div className={styles.backdrop} onMouseDown={onClose}>
      <section
        ref={dialog}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mode-atlas-title"
        aria-describedby="mode-atlas-description"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <header>
          <div>
            <p>{t.modeAtlas}</p>
            <h2 id="mode-atlas-title">{t.atlasTitle}</h2>
          </div>
          <button
            ref={closeButton}
            className={styles.close}
            type="button"
            onClick={onClose}
            aria-label={t.atlasClose}
          >
            ×
          </button>
        </header>
        <p id="mode-atlas-description" className={styles.description}>
          {t.atlasDescription}
        </p>

        <div className={styles.toolbar}>
          <div className={styles.tabs} role="tablist" aria-label={t.modes}>
            {VIEWS.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={view === item}
                className={view === item ? styles.tabActive : undefined}
                onClick={() => setView(item)}
              >
                {t[VIEW_LABEL[item]]}
              </button>
            ))}
          </div>

          <input
            className={styles.search}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={t.atlasSearch}
            placeholder={t.atlasSearch}
          />

          <div className={styles.tags} role="group" aria-label={t.atlasTags}>
            {MODE_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                aria-pressed={tags.includes(tag)}
                className={tags.includes(tag) ? styles.tagActive : undefined}
                onClick={() => toggleTag(tag)}
              >
                {t[TAG_LABEL[tag]]}
              </button>
            ))}
          </div>
        </div>

        <ol className={styles.modes}>
          {visible.length === 0 ? (
            <li className={styles.empty}>{t.atlasNoResults}</li>
          ) : (
            visible.map((mode, index) => {
              const active = mode.id === activeMode;
              return (
                <li key={mode.id} data-active={active}>
                  <div className={styles.modeMeta}>
                    <span>
                      {String(index + 1).padStart(2, '0')} /{' '}
                      {String(visible.length).padStart(2, '0')}
                    </span>
                    <span>
                      {mode.tags.map((tag) => t[TAG_LABEL[tag]]).join(' · ')}
                    </span>
                  </div>
                  <h3>{mode.title[locale]}</h3>
                  <p>{mode.question[locale]}</p>
                  <small>{mode.summary[locale]}</small>
                  <button
                    type="button"
                    disabled={active}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => selectMode(mode.id)}
                  >
                    {active ? t.atlasViewing : t.atlasPreview}
                  </button>
                </li>
              );
            })
          )}
        </ol>
      </section>
    </div>,
    document.body,
  );
}
