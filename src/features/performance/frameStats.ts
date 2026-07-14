export interface FrameStats {
  frameCount: number;
  durationMs: number;
  fps: number;
  frameTimeP50Ms: number;
  frameTimeP95Ms: number;
  longestFrameMs: number;
  slowFramePercent: number;
}

export function calculateFrameStats(
  timestamps: readonly number[],
): FrameStats | null {
  if (timestamps.length < 2) return null;

  const frameTimes = timestamps
    .slice(1)
    .map((timestamp, index) => timestamp - timestamps[index]!)
    .sort((a, b) => a - b);
  const durationMs = timestamps[timestamps.length - 1]! - timestamps[0]!;
  if (durationMs <= 0) return null;

  return {
    frameCount: timestamps.length,
    durationMs,
    fps: ((timestamps.length - 1) * 1000) / durationMs,
    frameTimeP50Ms: percentile(frameTimes, 0.5),
    frameTimeP95Ms: percentile(frameTimes, 0.95),
    longestFrameMs: frameTimes[frameTimes.length - 1]!,
    slowFramePercent:
      (frameTimes.filter((frameTime) => frameTime > 25).length /
        frameTimes.length) *
      100,
  };
}

function percentile(sortedValues: readonly number[], ratio: number): number {
  const index = Math.min(
    sortedValues.length - 1,
    Math.ceil(sortedValues.length * ratio) - 1,
  );
  return sortedValues[index]!;
}
