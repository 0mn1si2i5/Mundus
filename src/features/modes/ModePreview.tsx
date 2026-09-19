import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { Locale } from '../../i18n/messages';
import { messages } from '../../i18n/messages';
import { MODE_DEFINITIONS, type ModeId } from './modeRegistry';
import styles from './ModePreview.module.css';

export function ModePreview({
  locale,
  modeId,
  restoreFocusRef,
  onClose,
  onEnter,
}: {
  locale: Locale;
  modeId: ModeId;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  onEnter: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const enterButton = useRef<HTMLButtonElement>(null);
  const t = messages[locale];
  const mode = MODE_DEFINITIONS[modeId];

  useEffect(() => {
    const previousFocus = document.activeElement;
    const explicitRestore = restoreFocusRef?.current;
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    enterButton.current?.focus();
    return () => {
      root?.removeAttribute('inert');
      const target =
        explicitRestore ??
        (previousFocus instanceof HTMLElement ? previousFocus : null);
      if (target instanceof HTMLElement && target.isConnected) target.focus();
    };
  }, [restoreFocusRef]);

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
        aria-labelledby="mode-preview-title"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h2 id="mode-preview-title">{mode.title[locale]}</h2>
        <p className={styles.question}>{mode.question[locale]}</p>
        <p className={styles.summary}>{mode.summary[locale]}</p>
        <p className={styles.sourceScope}>{mode.sourceScope[locale]}</p>
        <p className={styles.maturity}>
          {mode.maturity === 'stable'
            ? t.maturityStable
            : t.maturityExperimental}
        </p>
        <div className={styles.actions}>
          <button ref={enterButton} type="button" onClick={onEnter}>
            {t.enterObservation}
          </button>
          <button type="button" onClick={onClose}>
            {t.previewClose}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
