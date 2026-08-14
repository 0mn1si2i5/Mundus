import type { CSSProperties } from 'react';
import type { Locale } from '../../i18n/messages';
import { messages } from '../../i18n/messages';
import { featuredModes, type ModeId } from './modeRegistry';
import styles from './ExhibitLobby.module.css';

export function ExhibitLobby({
  locale,
  onSelectPreview,
}: {
  locale: Locale;
  onSelectPreview: (mode: ModeId) => void;
}) {
  const t = messages[locale];
  const featured = featuredModes();

  return (
    <section className={styles.lobby} aria-labelledby="lobby-heading">
      <header className={styles.heading}>
        <h1 id="lobby-heading" tabIndex={-1}>
          {t.lobbyTitle}
        </h1>
        <p>{t.lobbyDescription}</p>
      </header>
      <ul className={styles.orbit} aria-label={t.modes}>
        {featured.map((mode, index) => {
          const angle = (index / featured.length) * Math.PI * 2 - Math.PI / 2;
          const orbitX = (Math.cos(angle) * 36).toFixed(1);
          const orbitY = (Math.sin(angle) * 28).toFixed(1);
          return (
            <li
              key={mode.id}
              className={styles.orbitItem}
              style={
                {
                  '--orbit-x': `${orbitX}vw`,
                  '--orbit-y': `${orbitY}vh`,
                } as CSSProperties
              }
            >
              <button
                type="button"
                className={styles.label}
                onClick={() => onSelectPreview(mode.id)}
              >
                <span className={styles.index}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className={styles.title}>{mode.title[locale]}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
