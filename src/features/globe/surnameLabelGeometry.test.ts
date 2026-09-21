import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
  getSafeSurnameLabelRadius,
  SURNAME_LABEL_MIN_CORNER_RADIUS,
} from './surnameLabelGeometry';

describe('surname label 3D clearance', () => {
  it('keeps every billboard corner outside the globe surface', () => {
    const direction = new Vector3(0.38, 0.52, 0.765).normalize();
    const right = new Vector3(1, 0, 0);
    const up = new Vector3(0, 1, 0);
    const width = 0.34;
    const heightRatio = 0.34;
    const radius = getSafeSurnameLabelRadius(
      direction,
      width,
      heightRatio,
      right,
      up,
    );
    const corners = [-1, 1].flatMap((horizontal) =>
      [-1, 1].map((vertical) =>
        direction
          .clone()
          .multiplyScalar(radius)
          .addScaledVector(right, (width / 2) * horizontal)
          .addScaledVector(up, ((width * heightRatio) / 2) * vertical),
      ),
    );

    expect(radius).toBeGreaterThanOrEqual(1.012);
    expect(
      Math.min(...corners.map((corner) => corner.length())),
    ).toBeGreaterThanOrEqual(SURNAME_LABEL_MIN_CORNER_RADIUS - 1e-9);
  });

  it('does not inflate small labels beyond the base shell unnecessarily', () => {
    const direction = new Vector3(0, 0, 1);
    const radius = getSafeSurnameLabelRadius(
      direction,
      0.01,
      0.34,
      new Vector3(1, 0, 0),
      new Vector3(0, 1, 0),
    );
    expect(radius).toBe(1.012);
  });
});
