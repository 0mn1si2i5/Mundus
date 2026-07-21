import { describe, expect, it } from 'vitest';
import {
  ANTIPODE_DRAG_RENDERING,
  GLOBE_COLOR_CONTRACT,
  GLOBE_RENDERING,
  SUNLINE_RENDERING,
  contrastRatio,
  sunlineOverlayAtAltitude,
} from './rendering';
import { BackSide, FrontSide } from 'three';
import { COUNTRY_TEXTURE_STYLE } from './countryData';

describe('matte parchment globe rendering contract', () => {
  it('uses a matte non-metallic surface and a warm readable light floor', () => {
    expect(GLOBE_RENDERING.material.roughness).toBeGreaterThanOrEqual(0.92);
    expect(GLOBE_RENDERING.material.metalness).toBeLessThanOrEqual(0.01);
    expect(GLOBE_RENDERING.ambient.intensity).toBeGreaterThanOrEqual(1.2);
    expect(GLOBE_RENDERING.directional.intensity).toBeLessThanOrEqual(1.5);
    expect(GLOBE_RENDERING.stars.count).toBe(0);
    expect(GLOBE_RENDERING.atmosphere.opacity).toBeLessThanOrEqual(0.02);
  });

  it('uses muted brown-gray graticules suitable for light paper', () => {
    expect(GLOBE_RENDERING.graticule.color).toBe('#746f63');
    expect(GLOBE_RENDERING.graticule.opacity).toBeGreaterThanOrEqual(0.3);
  });

  it('keeps Other Side marker layers and cross-section legible on land and ocean', () => {
    const surfaces = [
      COUNTRY_TEXTURE_STYLE.landColor,
      COUNTRY_TEXTURE_STYLE.oceanColor,
    ];
    for (const surface of surfaces) {
      expect(
        contrastRatio(GLOBE_COLOR_CONTRACT.origin.outer, surface),
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrastRatio(GLOBE_COLOR_CONTRACT.origin.center, surface),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(GLOBE_COLOR_CONTRACT.antipode.outer, surface),
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrastRatio(GLOBE_COLOR_CONTRACT.antipode.center, surface),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(GLOBE_COLOR_CONTRACT.crossSection.surface, surface),
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrastRatio(GLOBE_COLOR_CONTRACT.crossSection.interior, surface),
      ).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('Sunline rendering contract', () => {
  it('caps the night overlay while keeping paper and borders readable', () => {
    expect(SUNLINE_RENDERING.night.maxAlpha).toBeLessThanOrEqual(0.42);
    expect(sunlineOverlayAtAltitude(-30).alpha).toBe(
      SUNLINE_RENDERING.night.maxAlpha,
    );
    expect(sunlineOverlayAtAltitude(10).alpha).toBe(0);
    expect(sunlineOverlayAtAltitude(-3).color).toBe(
      SUNLINE_RENDERING.twilight.color,
    );
  });

  it('places interaction feedback above the night mask', () => {
    expect(SUNLINE_RENDERING.highlight.radius).toBeGreaterThan(
      SUNLINE_RENDERING.mask.radius,
    );
    expect(SUNLINE_RENDERING.selectedMarker.radius).toBeGreaterThan(
      SUNLINE_RENDERING.highlight.radius,
    );
    expect(SUNLINE_RENDERING.highlight.renderOrder).toBeGreaterThan(
      SUNLINE_RENDERING.mask.renderOrder,
    );
    expect(SUNLINE_RENDERING.selectedMarker.renderOrder).toBeGreaterThan(
      SUNLINE_RENDERING.highlight.renderOrder,
    );
    expect(SUNLINE_RENDERING.mask).toMatchObject({
      depthTest: true,
      depthWrite: false,
    });
    expect(SUNLINE_RENDERING.highlight).toMatchObject({
      depthTest: true,
      depthWrite: false,
    });
    expect(SUNLINE_RENDERING.selectedMarker).toMatchObject({
      depthTest: true,
      depthWrite: false,
    });
  });

  it('keeps the selected point visually distinct from the legacy sun marker', () => {
    expect(SUNLINE_RENDERING.selectedMarker.role).toBe('precision-point');
    expect(SUNLINE_RENDERING.solarMarker.role).toBe('subsolar-sphere-ring');
    expect(SUNLINE_RENDERING.selectedMarker.cssDiameter).toBeLessThan(
      SUNLINE_RENDERING.solarMarker.cssDiameter,
    );
    expect(SUNLINE_RENDERING.selectedMarker.radius).toBeGreaterThan(
      SUNLINE_RENDERING.solarMarker.radius,
    );
    expect(SUNLINE_RENDERING.selectedMarker.renderOrder).toBeGreaterThan(
      SUNLINE_RENDERING.solarMarker.renderOrder,
    );
    expect(SUNLINE_RENDERING.solarMarker).toMatchObject({
      depthTest: true,
      depthWrite: false,
    });
    expect(
      contrastRatio(
        GLOBE_COLOR_CONTRACT.sunline.selected,
        GLOBE_COLOR_CONTRACT.sunline.subsolar,
      ),
    ).toBeGreaterThanOrEqual(3);
  });
});

describe('Other Side drag cross-section rendering contract', () => {
  it('uses separate ordered transparent shell layers without writing depth', () => {
    expect(ANTIPODE_DRAG_RENDERING.outerShell).toMatchObject({
      radius: 1,
      side: FrontSide,
      depthTest: true,
      depthWrite: false,
    });
    expect(ANTIPODE_DRAG_RENDERING.outerShell.dragOpacity).toBeGreaterThan(0.6);
    expect(ANTIPODE_DRAG_RENDERING.outerShell.dragOpacity).toBeLessThan(0.9);
    expect(ANTIPODE_DRAG_RENDERING.innerWall).toMatchObject({
      side: BackSide,
      depthTest: true,
      depthWrite: false,
    });
    expect(ANTIPODE_DRAG_RENDERING.innerWall.radius).toBeLessThan(
      ANTIPODE_DRAG_RENDERING.outerShell.radius,
    );
    expect(ANTIPODE_DRAG_RENDERING.outerShell.renderOrder).toBeGreaterThan(
      ANTIPODE_DRAG_RENDERING.innerWall.renderOrder,
    );
    expect(ANTIPODE_DRAG_RENDERING.highlight.radius).toBeGreaterThan(
      ANTIPODE_DRAG_RENDERING.outerShell.radius,
    );
    expect(ANTIPODE_DRAG_RENDERING.highlight.renderOrder).toBeGreaterThan(
      ANTIPODE_DRAG_RENDERING.outerShell.renderOrder,
    );
    expect(ANTIPODE_DRAG_RENDERING.highlight).toMatchObject({
      depthTest: true,
      depthWrite: false,
    });
  });

  it('keeps the candle glow non-interactive and below cross-section markers', () => {
    expect(ANTIPODE_DRAG_RENDERING.centerGlow.core).toMatchObject({
      depthTest: false,
      depthWrite: false,
    });
    expect(ANTIPODE_DRAG_RENDERING.centerGlow.halo).toMatchObject({
      depthTest: false,
      depthWrite: false,
    });
    expect(
      ANTIPODE_DRAG_RENDERING.centerGlow.flickerAmplitude,
    ).toBeGreaterThanOrEqual(0.05);
    expect(
      ANTIPODE_DRAG_RENDERING.centerGlow.flickerAmplitude,
    ).toBeLessThanOrEqual(0.08);
    expect(ANTIPODE_DRAG_RENDERING.centerGlow.renderOrder).toBeLessThan(
      ANTIPODE_DRAG_RENDERING.markerRenderOrder,
    );
    expect(ANTIPODE_DRAG_RENDERING.centerNode.depthWrite).toBe(false);
  });
});
