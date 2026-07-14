import { createPortal } from 'react-dom';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { Locale } from '../../i18n/messages';
import { MODE_DEFINITIONS, MODE_ORDER, type ModeId } from './modeRegistry';
import styles from './ModeAtlas.module.css';

const COPY = {
  zh: {
    label: '模式图鉴',
    title: '三种观察地球的方式',
    description:
      '每一种模式都是一副观察地球的镜片。切换模式不会移动你正在看的地方。',
    close: '关闭模式图鉴',
    viewing: '正在观察',
    select: '用这种方式观察',
    categories: { spatial: '空间', human: '人类', temporal: '时间' },
  },
  en: {
    label: 'Mode atlas',
    title: 'Three ways of seeing Earth',
    description:
      'Each mode is a lens for observing Earth. Switching lenses keeps your current place in view.',
    close: 'Close mode atlas',
    viewing: 'Viewing',
    select: 'View through this lens',
    categories: { spatial: 'Spatial', human: 'Human', temporal: 'Temporal' },
  },
} as const;

export function ModeAtlas({
  locale,
  activeMode,
  onSelectMode,
  onClose,
}: {
  locale: Locale;
  activeMode: ModeId;
  onSelectMode: (mode: ModeId) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(true);
  const copy = COPY[locale];

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

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = dialog.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href]',
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
            <p>{copy.label}</p>
            <h2 id="mode-atlas-title">{copy.title}</h2>
          </div>
          <button
            ref={closeButton}
            className={styles.close}
            type="button"
            onClick={onClose}
            aria-label={copy.close}
          >
            ×
          </button>
        </header>
        <p id="mode-atlas-description" className={styles.description}>
          {copy.description}
        </p>
        <ol className={styles.modes}>
          {MODE_ORDER.map((modeId, index) => {
            const mode = MODE_DEFINITIONS[modeId];
            const active = modeId === activeMode;
            return (
              <li key={modeId} data-active={active}>
                <div className={styles.modeMeta}>
                  <span>
                    {String(index + 1).padStart(2, '0')} /{' '}
                    {String(MODE_ORDER.length).padStart(2, '0')}
                  </span>
                  <span>{copy.categories[mode.category]}</span>
                </div>
                <h3>{mode.title[locale]}</h3>
                <p>{mode.question[locale]}</p>
                <small>{mode.summary[locale]}</small>
                <button
                  type="button"
                  disabled={active}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    restoreFocus.current = false;
                    onSelectMode(modeId);
                  }}
                >
                  {active ? copy.viewing : copy.select}
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>,
    document.body,
  );
}
