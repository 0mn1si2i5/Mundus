import { useState } from 'react';
import type { Locale } from '../../i18n/messages';
import { useAppStore } from '../../state/appStore';
import { createShareUrl, type SharePrecision } from './shareUrl';
import styles from './ShareDialog.module.css';

const COPY = {
  zh: {
    title: '分享这一视角',
    description: '坐标会写入分享链接。你可以保留精确位置，或将坐标约化到整度。',
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
  const [preview, setPreview] = useState(() =>
    createShareUrl(window.location.href, { activeMode, point }, 'approximate'),
  );
  const [status, setStatus] = useState('');
  const copy = COPY[locale];

  async function copyLink(precision: SharePrecision) {
    const url = createShareUrl(
      window.location.href,
      { activeMode, point },
      precision,
    );
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
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className={styles.close}
          type="button"
          onClick={onClose}
          aria-label={copy.close}
        >
          ×
        </button>
        <p>URL / POSITION</p>
        <h2 id="share-title">{copy.title}</h2>
        <p>{copy.description}</p>
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
