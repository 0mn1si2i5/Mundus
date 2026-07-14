import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Locale } from '../../i18n/messages';
import { useAppStore } from '../../state/appStore';
import { createShareUrl, type SharePrecision } from './shareUrl';
import styles from './ShareDialog.module.css';

const COPY = {
  zh: {
    title: '分享这一视角',
    description: '坐标会写入分享链接。你可以保留精确位置，或将坐标约化到整度。',
    sunlineDescription:
      '坐标与当前 UTC 时间会固化到分享链接。你可以保留精确位置，或将坐标约化到整度。',
    exact: '复制精确位置',
    approximate: '复制约略位置',
    close: '关闭',
    copied: '链接已复制',
    failed: '无法自动复制，请复制下方链接。',
  },
  en: {
    title: 'Share this view',
    description:
      'Coordinates are included in the link. Keep the exact point or round it to whole degrees.',
    sunlineDescription:
      'Coordinates and the current UTC time are fixed in the link. Keep the exact point or round it to whole degrees.',
    exact: 'Copy exact location',
    approximate: 'Copy approximate location',
    close: 'Close',
    copied: 'Link copied',
    failed: 'Automatic copy failed. Copy the link below.',
  },
} as const;

export function ShareDialog({
  locale,
  onClose,
}: {
  locale: Locale;
  onClose: () => void;
}) {
  const activeMode = useAppStore((state) => state.activeMode);
  const point = useAppStore((state) => state.point);
  const developmentIndicator = useAppStore(
    (state) => state.developmentIndicator,
  );
  const developmentYear = useAppStore((state) => state.developmentYear);
  const sunlineTimeMs = useAppStore((state) => state.sunlineTimeMs);
  const sunlineClockMode = useAppStore((state) => state.sunlineClockMode);
  const shareableState = {
    activeMode,
    point,
    developmentIndicator,
    developmentYear,
    sunlineTimeMs,
    sunlineClockMode,
  };
  const [preview, setPreview] = useState(() =>
    createShareUrl(window.location.href, shareableState, 'approximate'),
  );
  const [status, setStatus] = useState('');
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const copy = COPY[locale];
  const description =
    activeMode === 'sunline' ? copy.sunlineDescription : copy.description;

  useEffect(() => {
    const restoreFocus = document.activeElement;
    closeButton.current?.focus();
    return () => {
      if (restoreFocus instanceof HTMLElement) restoreFocus.focus();
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>(
      'button:not([disabled])',
    );
    const first = buttons?.[0];
    const last = buttons?.[buttons.length - 1];
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function copyLink(precision: SharePrecision) {
    const url = createShareUrl(window.location.href, shareableState, precision);
    setPreview(url);
    try {
      await navigator.clipboard.writeText(url);
      setStatus(copy.copied);
    } catch {
      setStatus(copy.failed);
    }
  }

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <section
        ref={dialog}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        aria-describedby="share-description"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <button
          ref={closeButton}
          className={styles.close}
          type="button"
          onClick={onClose}
          aria-label={copy.close}
        >
          ×
        </button>
        <p>URL / POSITION</p>
        <h2 id="share-title">{copy.title}</h2>
        <p id="share-description">{description}</p>
        <code>{preview}</code>
        <div className={styles.actions}>
          <button type="button" onClick={() => copyLink('approximate')}>
            {copy.approximate}
          </button>
          <button type="button" onClick={() => copyLink('exact')}>
            {copy.exact}
          </button>
        </div>
        <output aria-live="polite">{status}</output>
      </section>
    </div>
  );
}
