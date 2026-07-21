import { Billboard, Line } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type Ref,
} from 'react';
import type { Group, PerspectiveCamera } from 'three';
import { Vector3 } from 'three';
import type { AntipodeRelation } from '../antipodes/relation';
import { sampleShortGeodesic } from '../antipodes/relation';
import { geoToVector3 } from './geo';
import { cssPixelsToWorldUnits } from './screenSpace';

const RELATION_RADIUS = 1.018;

export interface AntipodeRelationDiagnosticHandle {
  request: (reason: AntipodeRelationDiagnosticReason) => void;
}

export type AntipodeRelationDiagnosticReason =
  'mount' | 'point' | 'resize' | 'interaction' | 'camera-focus';

interface CityMarkerDiagnosticHandle {
  request: (reason: AntipodeRelationDiagnosticReason) => void;
}

export const AntipodeRelationLayer = forwardRef(function AntipodeRelationLayer(
  {
    relation,
    onArcCount,
    onMarkerSize,
  }: {
    relation: AntipodeRelation;
    onArcCount: (count: number | null) => void;
    onMarkerSize: (
      role: 'origin-city' | 'antipode-city',
      cssPixels: number | null,
      reason?: AntipodeRelationDiagnosticReason,
    ) => void;
  },
  ref: Ref<AntipodeRelationDiagnosticHandle>,
) {
  const originCity = relation.origin.nearestMajorCity;
  const antipodeCity = relation.antipode.nearestMajorCity;
  const onArcCountRef = useRef(onArcCount);
  const onMarkerSizeRef = useRef(onMarkerSize);
  useEffect(() => {
    onArcCountRef.current = onArcCount;
    onMarkerSizeRef.current = onMarkerSize;
  }, [onArcCount, onMarkerSize]);
  const originMarker = useRef<CityMarkerDiagnosticHandle>(null);
  const antipodeMarker = useRef<CityMarkerDiagnosticHandle>(null);
  const originArc = useMemo(
    () => relationPoints(relation.origin),
    [relation.origin],
  );
  const antipodeArc = useMemo(
    () => relationPoints(relation.antipode),
    [relation.antipode],
  );
  const arcCount =
    Number(originArc.length > 1) + Number(antipodeArc.length > 1);
  useEffect(() => {
    onArcCountRef.current(arcCount);
    return () => onArcCountRef.current(null);
  }, [arcCount]);
  useEffect(() => {
    if (!originCity || !antipodeCity) {
      onMarkerSizeRef.current('origin-city', null);
      onMarkerSizeRef.current('antipode-city', null);
    }
  }, [antipodeCity, originCity]);
  useEffect(() => {
    return () => {
      onMarkerSizeRef.current('origin-city', null);
      onMarkerSizeRef.current('antipode-city', null);
    };
  }, []);
  useImperativeHandle(ref, () => ({
    request(reason) {
      originMarker.current?.request(reason);
      antipodeMarker.current?.request(reason);
    },
  }));
  if (!originCity || !antipodeCity) return null;
  return (
    <>
      <CityMarker
        ref={originMarker}
        point={originCity.city.point}
        shape="square"
        cssPixels={7}
        color="#b88746"
        onSize={(cssPixels, reason) =>
          onMarkerSizeRef.current('origin-city', cssPixels, reason)
        }
      />
      <CityMarker
        ref={antipodeMarker}
        point={antipodeCity.city.point}
        shape="triangle"
        cssPixels={8}
        color="#79bba9"
        onSize={(cssPixels, reason) =>
          onMarkerSizeRef.current('antipode-city', cssPixels, reason)
        }
      />
      {originArc.length > 1 ? <RelationArc points={originArc} /> : null}
      {antipodeArc.length > 1 ? <RelationArc points={antipodeArc} /> : null}
    </>
  );
});

function relationPoints(side: AntipodeRelation['origin']): Vector3[] {
  if (!side.nearestMajorCity || side.nearestMajorCity.distanceKm < 0.001)
    return [];
  return sampleShortGeodesic(
    side.exactPoint,
    side.nearestMajorCity.city.point,
  ).map((point) => geoToVector3(point, RELATION_RADIUS));
}

function RelationArc({ points }: { points: Vector3[] }) {
  return (
    <Line
      points={points}
      color="#c89b5d"
      lineWidth={1.15}
      transparent
      opacity={0.82}
      depthTest
      depthWrite={false}
      raycast={ignoreRaycast}
      renderOrder={4}
    />
  );
}

const CityMarker = forwardRef(function CityMarker(
  {
    point,
    shape,
    cssPixels,
    color,
    onSize,
  }: {
    point: { latitude: number; longitude: number };
    shape: 'square' | 'triangle';
    cssPixels: number;
    color: string;
    onSize: (
      cssPixels: number,
      reason: AntipodeRelationDiagnosticReason,
    ) => void;
  },
  ref: Ref<CityMarkerDiagnosticHandle>,
) {
  const marker = useRef<Group>(null);
  const worldPosition = useRef(new Vector3());
  const cameraDirection = useRef(new Vector3());
  const cameraOffset = useRef(new Vector3());
  const cameraRight = useRef(new Vector3());
  const projectedCenter = useRef(new Vector3());
  const projectedEdge = useRef(new Vector3());
  const pending = useRef<AntipodeRelationDiagnosticReason | null>('mount');
  const position = useMemo(() => geoToVector3(point, 1.021), [point]);
  const { camera, size, invalidate } = useThree();
  const diagnosticSize = useRef(`${size.width}x${size.height}`);

  useImperativeHandle(ref, () => ({
    request(reason) {
      pending.current = reason;
      invalidate();
    },
  }));
  useEffect(() => {
    pending.current = 'point';
    invalidate();
  }, [invalidate, position]);
  useEffect(() => {
    const nextSize = `${size.width}x${size.height}`;
    if (diagnosticSize.current === nextSize) return;
    diagnosticSize.current = nextSize;
    pending.current = 'resize';
    invalidate();
  }, [invalidate, size.height, size.width]);

  useFrame(() => {
    const group = marker.current;
    if (!group) return;
    group.getWorldPosition(worldPosition.current);
    camera.getWorldDirection(cameraDirection.current);
    cameraOffset.current.subVectors(worldPosition.current, camera.position);
    const distance = cameraOffset.current.dot(cameraDirection.current);
    const worldDiameter = cssPixelsToWorldUnits(
      cssPixels,
      distance,
      (camera as PerspectiveCamera).fov,
      size.height,
    );
    group.scale.setScalar(worldDiameter);
    if (!pending.current) return;
    cameraRight.current.setFromMatrixColumn(camera.matrixWorld, 0);
    projectedCenter.current.copy(worldPosition.current).project(camera);
    projectedEdge.current
      .copy(worldPosition.current)
      .addScaledVector(cameraRight.current, worldDiameter / 2)
      .project(camera);
    const reason = pending.current;
    pending.current = null;
    onSize(
      Math.abs(projectedEdge.current.x - projectedCenter.current.x) *
        size.width,
      reason,
    );
  });

  return (
    <group ref={marker} position={position} renderOrder={6}>
      <Billboard>
        <mesh raycast={ignoreRaycast} renderOrder={6}>
          {shape === 'square' ? (
            <planeGeometry args={[1, 1]} />
          ) : (
            <circleGeometry args={[0.62, 3]} />
          )}
          <meshBasicMaterial
            color={color}
            depthTest
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </Billboard>
    </group>
  );
});

function ignoreRaycast() {}
