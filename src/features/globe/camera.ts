export const GLOBE_CAMERA_DISTANCE = { min: 1.55, max: 5 } as const;
export const CAMERA_FOCUS_DURATION_MS = 2_200;

export function clampGlobeCameraDistance(distance: number): number {
  return Math.min(
    GLOBE_CAMERA_DISTANCE.max,
    Math.max(GLOBE_CAMERA_DISTANCE.min, distance),
  );
}

export function cameraFocusAnimationProgress(
  startedAtMs: number,
  timestampMs: number,
): { progress: number; complete: boolean } {
  const elapsedMs = Math.max(0, timestampMs - startedAtMs);
  if (elapsedMs >= CAMERA_FOCUS_DURATION_MS) {
    return { progress: 1, complete: true };
  }
  return {
    progress: 1 - Math.exp((-3.2 * elapsedMs) / 1_000),
    complete: false,
  };
}
