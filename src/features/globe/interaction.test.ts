import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
  CLICK_DRAG_THRESHOLD_PX,
  isSelectionGesture,
  rotateCameraVertically,
  TOUCH_CLICK_DRAG_THRESHOLD_PX,
} from './interaction';

describe('globe interaction boundaries', () => {
  it('distinguishes a click from a drag by pointer travel', () => {
    expect(isSelectionGesture(0)).toBe(true);
    expect(isSelectionGesture(CLICK_DRAG_THRESHOLD_PX)).toBe(true);
    expect(isSelectionGesture(CLICK_DRAG_THRESHOLD_PX + 0.1)).toBe(false);
    expect(isSelectionGesture(8, TOUCH_CLICK_DRAG_THRESHOLD_PX)).toBe(true);
    expect(isSelectionGesture(Number.NaN)).toBe(false);
  });

  it('clamps keyboard rotation before the camera crosses either pole', () => {
    const north = rotateCameraVertically(new Vector3(0, 0, 3), -Math.PI);
    const south = rotateCameraVertically(new Vector3(0, 0, 3), Math.PI);

    expect(north.length()).toBeCloseTo(3);
    expect(south.length()).toBeCloseTo(3);
    expect(north.y).toBeGreaterThan(0);
    expect(south.y).toBeLessThan(0);
    expect(Math.abs(north.y)).toBeLessThan(3);
    expect(Math.abs(south.y)).toBeLessThan(3);
  });
});
