export interface SurnameLabelScreenRect {
  id: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  frontFacing: boolean;
  selected: boolean;
}

export interface SurnameLabelObstacle {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export type SurnameLabelHiddenReason =
  'backface' | 'outside-viewport' | 'obstacle' | 'collision' | 'invalid';

export interface SurnameLabelLayout {
  visibleIds: ReadonlySet<string>;
  hiddenReasons: ReadonlyMap<string, SurnameLabelHiddenReason>;
  visibleCount: number;
  collisionCount: number;
  selectedVisible: boolean;
}

const VIEWPORT_PADDING_PX = 2;
const OBSTACLE_PADDING_PX = 3;

/**
 * Resolves billboard rectangles in stable priority order. The selected
 * country's label is considered first; smaller labels then get preference so
 * dense regions retain more labels without allowing any overlap.
 */
export function computeSurnameLabelLayout(
  rectangles: readonly SurnameLabelScreenRect[],
  obstacles: readonly SurnameLabelObstacle[],
  viewport: { width: number; height: number },
): SurnameLabelLayout {
  const ordered = [...rectangles].sort(
    (a, b) =>
      Number(b.selected) - Number(a.selected) ||
      rectArea(a) - rectArea(b) ||
      a.id.localeCompare(b.id),
  );
  const accepted: SurnameLabelScreenRect[] = [];
  const visibleIds = new Set<string>();
  const hiddenReasons = new Map<string, SurnameLabelHiddenReason>();
  let collisionCount = 0;

  for (const rectangle of ordered) {
    const reason = hiddenReason(rectangle, accepted, obstacles, viewport);
    if (reason) {
      hiddenReasons.set(rectangle.id, reason);
      if (reason === 'obstacle' || reason === 'collision') {
        collisionCount += 1;
      }
      continue;
    }
    accepted.push(rectangle);
    visibleIds.add(rectangle.id);
  }

  return {
    visibleIds,
    hiddenReasons,
    visibleCount: visibleIds.size,
    collisionCount,
    selectedVisible: ordered.some(
      (rectangle) => rectangle.selected && visibleIds.has(rectangle.id),
    ),
  };
}

function hiddenReason(
  rectangle: SurnameLabelScreenRect,
  accepted: readonly SurnameLabelScreenRect[],
  obstacles: readonly SurnameLabelObstacle[],
  viewport: { width: number; height: number },
): SurnameLabelHiddenReason | null {
  if (!hasFiniteRect(rectangle)) return 'invalid';
  if (!rectangle.frontFacing) return 'backface';
  if (
    rectangle.left < VIEWPORT_PADDING_PX ||
    rectangle.right > viewport.width - VIEWPORT_PADDING_PX ||
    rectangle.top < VIEWPORT_PADDING_PX ||
    rectangle.bottom > viewport.height - VIEWPORT_PADDING_PX
  ) {
    return 'outside-viewport';
  }
  if (
    obstacles.some((obstacle) => intersectsWithPadding(rectangle, obstacle))
  ) {
    return 'obstacle';
  }
  if (accepted.some((other) => intersects(rectangle, other))) {
    return 'collision';
  }
  return null;
}

function hasFiniteRect(rectangle: SurnameLabelScreenRect): boolean {
  return [
    rectangle.left,
    rectangle.right,
    rectangle.top,
    rectangle.bottom,
  ].every(Number.isFinite);
}

function rectArea(rectangle: SurnameLabelScreenRect): number {
  const width = Math.max(0, rectangle.right - rectangle.left);
  const height = Math.max(0, rectangle.bottom - rectangle.top);
  return width * height;
}

function intersects(
  first: SurnameLabelScreenRect,
  second: SurnameLabelScreenRect,
): boolean {
  return (
    first.left < second.right &&
    first.right > second.left &&
    first.top < second.bottom &&
    first.bottom > second.top
  );
}

function intersectsWithPadding(
  rectangle: SurnameLabelScreenRect,
  obstacle: SurnameLabelObstacle,
): boolean {
  return (
    rectangle.left < obstacle.right + OBSTACLE_PADDING_PX &&
    rectangle.right > obstacle.left - OBSTACLE_PADDING_PX &&
    rectangle.top < obstacle.bottom + OBSTACLE_PADDING_PX &&
    rectangle.bottom > obstacle.top - OBSTACLE_PADDING_PX
  );
}
