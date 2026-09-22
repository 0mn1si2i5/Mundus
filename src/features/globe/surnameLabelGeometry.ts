import { Vector3 } from 'three';

export const SURNAME_LABEL_BASE_RADIUS = 1.012;
export const SURNAME_LABEL_MIN_CORNER_RADIUS = 1.006;

/**
 * Moves a billboard just far enough out that every camera-facing corner stays
 * outside the globe surface. The radial solve is cheaper and less visually
 * detached than using a worst-case radius for every camera orientation.
 */
export function getSafeSurnameLabelRadius(
  direction: Vector3,
  width: number,
  heightRatio: number,
  cameraRight: Vector3,
  cameraUp: Vector3,
): number {
  const halfWidth = width / 2;
  const halfHeight = (width * heightRatio) / 2;
  const offsetSquared = halfWidth ** 2 + halfHeight ** 2;
  const rightProjection = direction.dot(cameraRight);
  const upProjection = direction.dot(cameraUp);
  let radius = SURNAME_LABEL_BASE_RADIUS;

  for (const horizontal of [-1, 1]) {
    for (const vertical of [-1, 1]) {
      const radialProjection =
        halfWidth * horizontal * rightProjection +
        halfHeight * vertical * upProjection;
      const discriminant =
        radialProjection ** 2 +
        SURNAME_LABEL_MIN_CORNER_RADIUS ** 2 -
        offsetSquared;
      if (discriminant >= 0) {
        radius = Math.max(radius, -radialProjection + Math.sqrt(discriminant));
      }
    }
  }
  return radius;
}
