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
