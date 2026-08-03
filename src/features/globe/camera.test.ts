import { describe, expect, test } from 'vitest';
import {
  cameraFocusAnimationProgress,
  clampGlobeCameraDistance,
  GLOBE_CAMERA_DISTANCE,
} from './camera';

describe('globe camera distance', () => {
  test('publishes the shared outside-globe zoom range', () => {
    expect(GLOBE_CAMERA_DISTANCE).toEqual({ min: 1.55, max: 5 });
  });

  test('clamps distances to the shared range', () => {
    expect(clampGlobeCameraDistance(1)).toBe(1.55);
    expect(clampGlobeCameraDistance(3.25)).toBe(3.25);
    expect(clampGlobeCameraDistance(6)).toBe(5);
  });
});

describe('cameraFocusAnimationProgress', () => {
  test('uses elapsed timestamps and completes after the bounded duration with sparse frames', () => {
    expect(cameraFocusAnimationProgress(1_000, 1_000)).toEqual({
      progress: 0,
      complete: false,
    });
    expect(cameraFocusAnimationProgress(1_000, 1_750)).toEqual({
      progress: expect.closeTo(1 - Math.exp(-3.2 * 0.75)),
      complete: false,
    });
    expect(cameraFocusAnimationProgress(1_000, 3_200)).toEqual({
      progress: 1,
      complete: true,
    });
  });
});
