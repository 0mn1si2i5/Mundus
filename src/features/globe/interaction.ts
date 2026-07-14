import { MathUtils, Spherical, Vector3 } from 'three';

export const CLICK_DRAG_THRESHOLD_PX = 5;
export const TOUCH_CLICK_DRAG_THRESHOLD_PX = 10;
const MIN_POLAR_ANGLE = MathUtils.degToRad(5);

export function isSelectionGesture(
  pointerDelta: number,
  threshold = CLICK_DRAG_THRESHOLD_PX,
): boolean {
  return (
    Number.isFinite(pointerDelta) &&
    pointerDelta >= 0 &&
    pointerDelta <= threshold
  );
}

export function rotateCameraVertically(
  position: Vector3,
  radians: number,
): Vector3 {
  const spherical = new Spherical().setFromVector3(position);
  spherical.phi = MathUtils.clamp(
    spherical.phi + radians,
    MIN_POLAR_ANGLE,
    Math.PI - MIN_POLAR_ANGLE,
  );
  return position.setFromSpherical(spherical);
}
