import type { Locale } from '../../i18n/messages';
import type { GeoPoint } from '../globe/geo';
import { ModeControls } from './ModeControls';
import { ModeResult } from './ModeResult';
import { useModePresentation } from './useModePresentation';

/**
 * Renders the active-mode result and controls from a single bounded
 * presentation hook. Any presentation, data, chunk, or render error inside
 * this subtree is contained by the caller's error boundary, leaving the
 * shell (header, language, atlas, return-to-lobby) intact.
 */
export function ModeExperience({
  locale,
  onCameraFocus,
}: {
  locale: Locale;
  onCameraFocus: (point: GeoPoint) => void;
}) {
  const presentation = useModePresentation();
  if (presentation === null) return null;

  return (
    <>
      <ModeResult
        locale={locale}
        presentation={presentation}
        onCameraFocus={onCameraFocus}
      />
      <ModeControls locale={locale} presentation={presentation} />
    </>
  );
}
