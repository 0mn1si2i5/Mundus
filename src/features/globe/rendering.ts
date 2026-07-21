import { BackSide, FrontSide } from 'three';

export const GLOBE_RENDERING = {
  material: { roughness: 0.96, metalness: 0 },
  ambient: { color: '#f2e7cf', intensity: 1.35 },
  directional: { color: '#fff0ce', intensity: 0.72 },
  stars: { count: 0 },
  atmosphere: { opacity: 0 },
  graticule: { color: '#746f63', opacity: 0.34 },
} as const;

export const ANTIPODE_DRAG_RENDERING = {
  outerShell: {
    radius: 1,
    renderOrder: 2,
    color: '#ffffff',
    dragOpacity: 0.76,
    side: FrontSide,
    depthTest: true,
    depthWrite: false,
  },
  innerWall: {
    radius: 0.985,
    renderOrder: 1,
    color: '#7b5542',
    opacity: 0.3,
    side: BackSide,
    depthTest: true,
    depthWrite: false,
  },
  highlight: {
    radius: 1.002,
    renderOrder: 3,
    depthTest: true,
    depthWrite: false,
  },
  centerGlow: {
    renderOrder: 4,
    flickerAmplitude: 0.065,
    core: {
      radius: 0.035,
      color: '#ffd28a',
      opacity: 0.92,
      depthTest: false,
      depthWrite: false,
    },
    halo: {
      radius: 0.095,
      color: '#ef8b45',
      opacity: 0.16,
      depthTest: false,
      depthWrite: false,
    },
  },
  centerNode: { depthWrite: false },
  markerRenderOrder: 5,
} as const;

export const GLOBE_COLOR_CONTRACT = {
  origin: { outer: '#7f2f24', center: '#29241e' },
  antipode: { outer: '#293d63', center: '#29241e' },
  crossSection: {
    surface: '#293d63',
    interior: '#29241e',
    center: '#29241e',
  },
  sunline: { selected: '#8d4f37', subsolar: '#e1bd61' },
} as const;

export const SUNLINE_RENDERING = {
  mask: {
    radius: 1.009,
    renderOrder: 2,
    depthTest: true,
    depthWrite: false,
  },
  night: { color: '#59636a', maxAlpha: 0.4 },
  twilight: { color: '#777080' },
  highlight: {
    radius: 1.014,
    renderOrder: 4,
    depthTest: true,
    depthWrite: false,
  },
  selectedMarker: {
    role: 'precision-point',
    radius: 1.032,
    renderOrder: 6,
    cssDiameter: 8,
    depthTest: true,
    depthWrite: false,
  },
  solarMarker: {
    role: 'subsolar-sphere-ring',
    radius: 1.028,
    renderOrder: 5,
    cssDiameter: 14,
    depthTest: true,
    depthWrite: false,
  },
} as const;

export function sunlineOverlayAtAltitude(altitudeDegrees: number) {
  if (altitudeDegrees >= 0) {
    return { color: SUNLINE_RENDERING.twilight.color, alpha: 0 };
  }
  if (altitudeDegrees >= -6) {
    return {
      color: SUNLINE_RENDERING.twilight.color,
      alpha:
        SUNLINE_RENDERING.night.maxAlpha *
        Math.min(1, Math.max(0, -altitudeDegrees / 6)),
    };
  }
  return {
    color: SUNLINE_RENDERING.night.color,
    alpha: SUNLINE_RENDERING.night.maxAlpha,
  };
}

export function contrastRatio(first: string, second: string): number {
  const luminance = (color: string) => {
    const channels = [1, 3, 5].map(
      (offset) => Number.parseInt(color.slice(offset, offset + 2), 16) / 255,
    );
    const [red, green, blue] = channels.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
  };
  const light = Math.max(luminance(first), luminance(second));
  const dark = Math.min(luminance(first), luminance(second));
  return (light + 0.05) / (dark + 0.05);
}
