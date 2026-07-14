import {
  Canvas,
  type ThreeEvent,
  useFrame,
  useThree,
} from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Group } from 'three';
import { AdditiveBlending, BackSide, type Vector3 } from 'three';
import { useAppStore } from '../../state/appStore';
import { useFrameBenchmark } from '../performance/useFrameBenchmark';
import { createCountryTexture, getCountryDataset } from './countryData';
import { antipodeOf, geoToVector3, vector3ToGeo } from './geo';
import { detectQualityProfile, type QualityProfile } from './quality';
import { supportsWebGL2 } from './webgl';
import styles from './GlobeViewport.module.css';

interface GlobeViewportProps {
  fallbackLabel: string;
  contextLostLabel: string;
}

export function GlobeViewport({
  fallbackLabel,
  contextLostLabel,
}: GlobeViewportProps) {
  const [supported] = useState(supportsWebGL2);
  const [profile] = useState(detectQualityProfile);
  const [contextLost, setContextLost] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const benchmark = useFrameBenchmark(profile.level);

  useEffect(() => {
    const canvas = viewport.current?.querySelector('canvas');
    if (!canvas) return;
    const lost = (event: Event) => {
      event.preventDefault();
      setContextLost(true);
    };
    const restored = () => {
      setContextLost(false);
    };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    return () => {
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
    };
  }, []);

  if (!supported) {
    return (
      <section className={styles.unavailable} role="status">
        <div className={styles.staticGlobe} />
        <p>{fallbackLabel}</p>
      </section>
    );
  }

  return (
    <div
      ref={viewport}
      className={styles.viewport}
      aria-label="Interactive globe"
      data-quality={profile.level}
    >
      <Canvas
        dpr={profile.dpr}
        frameloop="demand"
        camera={{ position: [0, 0.15, 3.25], fov: 38, near: 0.1, far: 100 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
      >
        <GlobeScene
          profile={profile}
          benchmarkActive={benchmark.active}
          recordBenchmarkFrame={benchmark.recordFrame}
        />
      </Canvas>
      {contextLost ? (
        <p className={styles.contextStatus} role="status">
          {contextLostLabel}
        </p>
      ) : null}
      {benchmark.enabled ? (
        <BenchmarkPanel phase={benchmark.phase} result={benchmark.result} />
      ) : null}
    </div>
  );
}

interface GlobeSceneProps {
  profile: QualityProfile;
  benchmarkActive: boolean;
  recordBenchmarkFrame: (timestamp: number) => void;
}

function GlobeScene({
  profile,
  benchmarkActive,
  recordBenchmarkFrame,
}: GlobeSceneProps) {
  const point = useAppStore((state) => state.point);
  const selectedCountry = useAppStore((state) => state.selectedCountry);
  const hoveredCountry = useAppStore((state) => state.hoveredCountry);
  const hasInteracted = useAppStore((state) => state.hasInteracted);
  const selectPoint = useAppStore((state) => state.selectPoint);
  const markInteraction = useAppStore((state) => state.markInteraction);
  const setSelectedCountry = useAppStore((state) => state.setSelectedCountry);
  const setHoveredCountry = useAppStore((state) => state.setHoveredCountry);
  const group = useRef<Group>(null);
  const { invalidate } = useThree();
  const reducedMotion = useReducedMotion();
  const countries = useMemo(() => getCountryDataset(), []);
  const texture = useMemo(
    () =>
      createCountryTexture(
        countries,
        profile.textureWidth,
        hoveredCountry?.countryId ?? null,
        selectedCountry?.countryId ?? null,
      ),
    [
      countries,
      hoveredCountry?.countryId,
      profile.textureWidth,
      selectedCountry?.countryId,
    ],
  );

  const primary = useMemo(() => geoToVector3(point, 1.025), [point]);
  const antipode = useMemo(
    () => geoToVector3(antipodeOf(point), 1.025),
    [point],
  );

  useEffect(() => () => texture.dispose(), [texture]);

  useEffect(() => {
    setSelectedCountry(countries.findCountry(point));
  }, [countries, point, setSelectedCountry]);

  useFrame((_, delta) => {
    if (benchmarkActive) {
      recordBenchmarkFrame(performance.now());
      invalidate();
    }
    if (!hasInteracted && !reducedMotion && group.current) {
      group.current.rotation.y += delta * 0.035;
      invalidate();
    }
  });

  function handleSelect(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    if (!group.current) return;
    const selectedPoint = vector3ToGeo(
      group.current.worldToLocal(event.point.clone()),
    );
    selectPoint(selectedPoint);
    setSelectedCountry(countries.findCountry(selectedPoint));
    invalidate();
  }

  function handleHover(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    if (!group.current) return;
    const hoverPoint = vector3ToGeo(
      group.current.worldToLocal(event.point.clone()),
    );
    setHoveredCountry(countries.findCountry(hoverPoint));
  }

  return (
    <>
      <ambientLight intensity={0.85} color="#8ca0a4" />
      <directionalLight position={[-3, 2, 4]} intensity={3.2} color="#dfe7d5" />
      <Stars
        radius={30}
        depth={18}
        count={profile.starCount}
        factor={1.1}
        fade
        speed={0}
      />
      <group ref={group}>
        <mesh
          onClick={handleSelect}
          onPointerMove={handleHover}
          onPointerOut={() => setHoveredCountry(null)}
        >
          <sphereGeometry args={[1, ...profile.sphereSegments]} />
          <meshStandardMaterial
            map={texture}
            roughness={0.9}
            metalness={0.05}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[1.004, 48, 32]} />
          <meshBasicMaterial
            color="#76918c"
            wireframe
            transparent
            opacity={0.11}
          />
        </mesh>
        <mesh scale={1.075}>
          <sphereGeometry args={[1, 64, 48]} />
          <meshBasicMaterial
            color="#7da19f"
            side={BackSide}
            transparent
            opacity={0.08}
            blending={AdditiveBlending}
          />
        </mesh>
        <Marker position={primary} color="#e8e0c8" />
        <Marker position={antipode} color="#9cc7b7" />
      </group>
      <OrbitControls
        enablePan={false}
        minDistance={2.15}
        maxDistance={5}
        rotateSpeed={0.55}
        zoomSpeed={0.65}
        onStart={markInteraction}
        onChange={() => invalidate()}
        makeDefault
      />
    </>
  );
}

function BenchmarkPanel({
  phase,
  result,
}: {
  phase: string;
  result: ReturnType<typeof useFrameBenchmark>['result'];
}) {
  return (
    <output className={styles.benchmark} data-phase={phase} aria-live="polite">
      <span>Render benchmark · {phase}</span>
      {result ? (
        <strong>
          {result.fps.toFixed(1)} fps · p95 {result.frameTimeP95Ms.toFixed(1)}{' '}
          ms · {result.quality}
        </strong>
      ) : (
        <strong>Collecting actual R3F frames…</strong>
      )}
    </output>
  );
}

function Marker({ position, color }: { position: Vector3; color: string }) {
  const vector = position;
  return (
    <group position={[vector.x, vector.y, vector.z]}>
      <mesh>
        <sphereGeometry args={[0.025, 20, 20]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.04, 0.052, 28]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} side={2} />
      </mesh>
    </group>
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}
