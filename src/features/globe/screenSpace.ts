export function cssPixelsToWorldUnits(
  cssPixels: number,
  distance: number,
  verticalFovDegrees: number,
  viewportHeightCssPixels: number,
): number {
  if (
    !Number.isFinite(cssPixels) ||
    !Number.isFinite(distance) ||
    !Number.isFinite(verticalFovDegrees) ||
    !Number.isFinite(viewportHeightCssPixels) ||
    cssPixels <= 0 ||
    distance <= 0 ||
    verticalFovDegrees <= 0 ||
    viewportHeightCssPixels <= 0
  ) {
    return 0;
  }
  const visibleHeight =
    2 * distance * Math.tan((verticalFovDegrees * Math.PI) / 360);
  return (visibleHeight * cssPixels) / viewportHeightCssPixels;
}

export function allPointsInClip(
  points: ReadonlyArray<{ x: number; y: number; z: number }>,
): boolean {
  return (
    points.length > 0 &&
    points.every(
      ({ x, y, z }) =>
        Number.isFinite(x) &&
        Number.isFinite(y) &&
        Number.isFinite(z) &&
        Math.abs(x) <= 1 &&
        Math.abs(y) <= 1 &&
        z >= -1 &&
        z <= 1,
    )
  );
}
