import { describe, expect, it } from 'vitest';
import {
  computeSurnameLabelLayout,
  type SurnameLabelScreenRect,
} from './surnameLabelLayout';

function rect(
  id: string,
  left: number,
  top: number,
  width: number,
  height: number,
  overrides: Partial<SurnameLabelScreenRect> = {},
): SurnameLabelScreenRect {
  return {
    id,
    left,
    right: left + width,
    top,
    bottom: top + height,
    frontFacing: true,
    selected: false,
    ...overrides,
  };
}

describe('surname label layout', () => {
  it('keeps the selected label ahead of overlapping labels', () => {
    const layout = computeSurnameLabelLayout(
      [
        rect('other', 40, 40, 80, 30),
        rect('selected', 40, 40, 80, 30, { selected: true }),
      ],
      [],
      { width: 200, height: 120 },
    );

    expect([...layout.visibleIds]).toEqual(['selected']);
    expect(layout.hiddenReasons.get('other')).toBe('collision');
    expect(layout.selectedVisible).toBe(true);
  });

  it('prefers smaller labels in a dense region while keeping rectangles disjoint', () => {
    const layout = computeSurnameLabelLayout(
      [
        rect('large', 40, 40, 90, 40),
        rect('small', 80, 60, 20, 12),
        rect('separate', 150, 40, 30, 20),
      ],
      [],
      { width: 200, height: 120 },
    );

    expect([...layout.visibleIds]).toEqual(['small', 'separate']);
    expect(layout.hiddenReasons.get('large')).toBe('collision');
    expect(layout.collisionCount).toBe(1);
  });

  it('rejects back-facing, edge-clipped, invalid, and obstructed labels', () => {
    const layout = computeSurnameLabelLayout(
      [
        rect('back', 20, 20, 20, 10, { frontFacing: false }),
        rect('edge', 0, 20, 20, 10),
        rect('invalid', Number.NaN, 20, 20, 10),
        rect('obstacle', 70, 20, 20, 10),
        rect('safe', 20, 70, 20, 10),
      ],
      [{ left: 60, right: 100, top: 10, bottom: 60 }],
      { width: 120, height: 100 },
    );

    expect([...layout.visibleIds]).toEqual(['safe']);
    expect(layout.hiddenReasons.get('back')).toBe('backface');
    expect(layout.hiddenReasons.get('edge')).toBe('outside-viewport');
    expect(layout.hiddenReasons.get('invalid')).toBe('invalid');
    expect(layout.hiddenReasons.get('obstacle')).toBe('obstacle');
  });
});
