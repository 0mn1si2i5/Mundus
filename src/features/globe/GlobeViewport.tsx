import {
  Canvas,
  type ThreeEvent,
  useFrame,
  useThree,
} from '@react-three/fiber';
import { Line, OrbitControls, Stars } from '@react-three/drei';
import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from 'react';
import type { Group } from 'three';
import {
  AdditiveBlending,
  BackSide,
  MathUtils,
  Quaternion,
  Vector3,
} from 'three';
import { useAppStore } from '../../state/appStore';
import { useFrameBenchmark } from '../performance/useFrameBenchmark';
import { createCountryTexture, getCountryDataset } from './countryData';
import { antipodeOf, geoToVector3, vector3ToGeo } from './geo';
import {
  isSelectionGesture,
  rotateCameraVertically,
  TOUCH_CLICK_DRAG_THRESHOLD_PX,
} from './interaction';
import { detectQualityProfile, type QualityProfile } from './quality';
import { supportsWebGL2 } from './webgl';
import styles from './GlobeViewport.module.css';

interface GlobeViewportProps {
  fallbackLabel: string;
  contextLostLabel: string;
  ariaLabel: string;
  keyboardInstructions: string;
  keyboardMovedLabel: string;
  keyboardZoomedLabel: string;
  keyboardSelectedLabel: string;
  countryFills: ReadonlyMap<string, string> | null;
  showAntipodes: boolean;
}

interface GlobeKeyboardController {
  rotateHorizontal: (radians: number) => void;
  rotateVertical: (radians: number) => void;
  zoom: (factor: number) => void;
  selectCenter: () => void;
}

export function GlobeViewport({
  fallbackLabel,
  contextLostLabel,
  ariaLabel,
  keyboardInstructions,
  keyboardMovedLabel,
  keyboardZoomedLabel,
  keyboardSelectedLabel,
  countryFills,
  showAntipodes,
}: GlobeViewportProps) {
  const [supported] = useState(supportsWebGL2);
  const [profile] = useState(detectQualityProfile);
  const [contextLost, setContextLost] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const keyboardController = useRef<GlobeKeyboardController>(null);
  const [keyboardStatus, setKeyboardStatus] = useState('');
  const benchmark = useFrameBenchmark(profile.level);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const controller = keyboardController.current;
    if (!controller) return;
    const rotationStep = MathUtils.degToRad(event.shiftKey ? 15 : 5);

    switch (event.key) {
      case 'ArrowLeft':
        controller.rotateHorizontal(rotationStep);
        setKeyboardStatus(keyboardMovedLabel);
        break;
      case 'ArrowRight':
        controller.rotateHorizontal(-rotationStep);
        setKeyboardStatus(keyboardMovedLabel);
        break;
      case 'ArrowUp':
        controller.rotateVertical(-rotationStep);
        setKeyboardStatus(keyboardMovedLabel);
        break;
      case 'ArrowDown':
        controller.rotateVertical(rotationStep);
        setKeyboardStatus(keyboardMovedLabel);
        break;
      case '+':
      case '=':
        controller.zoom(0.88);
        setKeyboardStatus(keyboardZoomedLabel);
        break;
      case '-':
      case '_':
        controller.zoom(1.14);
        setKeyboardStatus(keyboardZoomedLabel);
        break;
      case 'Enter':
        controller.selectCenter();
        setKeyboardStatus(keyboardSelectedLabel);
        break;
      default:
        return;
    }

    event.preventDefault();
  }

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
      role="region"
      aria-label={ariaLabel}
      aria-describedby="globe-keyboard-instructions"
      data-quality={profile.level}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <p id="globe-keyboard-instructions" className={styles.visuallyHidden}>
        {keyboardInstructions}
      </p>
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
          keyboardController={keyboardController}
          countryFills={countryFills}
          showAntipodes={showAntipodes}
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
      <output className={styles.visuallyHidden} aria-live="polite">
        {keyboardStatus}
      </output>
    </div>
  );
}

interface GlobeSceneProps {
  profile: QualityProfile;
  benchmarkActive: boolean;
  recordBenchmarkFrame: (timestamp: number) => void;
  keyboardController: Ref<GlobeKeyboardController>;
  countryFills: ReadonlyMap<string, string> | null;
  showAntipodes: boolean;
}

function GlobeScene({
  profile,
  benchmarkActive,
  recordBenchmarkFrame,
  keyboardController,
  countryFills,
  showAntipodes,
}: GlobeSceneProps) {
  const point = useAppStore((state) => state.point);
  const selectedCountry = useAppStore((state) => state.selectedCountry);
  const hoveredCountry = useAppStore((state) => state.hoveredCountry);
  const cameraTarget = useAppStore((state) => state.cameraTarget);
  const hasInteracted = useAppStore((state) => state.hasInteracted);
  const selectPoint = useAppStore((state) => state.selectPoint);
  const markInteraction = useAppStore((state) => state.markInteraction);
  const setSelectedCountry = useAppStore((state) => state.setSelectedCountry);
  const setAntipodeCountry = useAppStore((state) => state.setAntipodeCountry);
  const setHoveredCountry = useAppStore((state) => state.setHoveredCountry);
  const clearCameraTarget = useAppStore((state) => state.clearCameraTarget);
  const group = useRef<Group>(null);
  const { camera, invalidate } = useThree();
  const reducedMotion = useReducedMotion();
  const countries = useMemo(() => getCountryDataset(), []);
  const texture = useMemo(
    () =>
      createCountryTexture(
        countries,
        profile.textureWidth,
        hoveredCountry?.countryId ?? null,
        selectedCountry?.countryId ?? null,
        countryFills,
      ),
    [
      countries,
      hoveredCountry?.countryId,
      profile.textureWidth,
      selectedCountry?.countryId,
      countryFills,
    ],
  );

  const primary = useMemo(() => geoToVector3(point, 1.025), [point]);
  const antipode = useMemo(
    () => geoToVector3(antipodeOf(point), 1.025),
    [point],
  );

  useImperativeHandle(keyboardController, () => {
    function finishCameraMove() {
      camera.lookAt(0, 0, 0);
      clearCameraTarget();
      markInteraction();
      invalidate();
    }

    return {
      rotateHorizontal(radians) {
        camera.position.applyAxisAngle(new Vector3(0, 1, 0), radians);
        finishCameraMove();
      },
      rotateVertical(radians) {
        rotateCameraVertically(camera.position, radians);
        finishCameraMove();
      },
      zoom(factor) {
        camera.position.setLength(
          MathUtils.clamp(camera.position.length() * factor, 2.15, 5),
        );
        finishCameraMove();
      },
      selectCenter() {
        if (!group.current) return;
        const center = vector3ToGeo(
          group.current.worldToLocal(camera.position.clone()).normalize(),
        );
        selectPoint(center);
        setSelectedCountry(countries.findCountry(center));
        invalidate();
      },
    };
  }, [
    camera,
    clearCameraTarget,
    countries,
    invalidate,
    markInteraction,
    selectPoint,
    setSelectedCountry,
  ]);

  useEffect(() => () => texture.dispose(), [texture]);

  useEffect(() => {
    setSelectedCountry(countries.findCountry(point));
    setAntipodeCountry(countries.findCountry(antipodeOf(point)));
  }, [countries, point, setAntipodeCountry, setSelectedCountry]);

  useFrame((_, delta) => {
    if (benchmarkActive) {
      recordBenchmarkFrame(performance.now());
      invalidate();
    }
    if (!hasInteracted && !reducedMotion && group.current) {
      group.current.rotation.y += delta * 0.035;
      invalidate();
    }
    if (cameraTarget && group.current) {
      const cameraDistance = camera.position.length();
      const currentDirection = camera.position.clone().normalize();
      const targetDirection = geoToVector3(cameraTarget)
        .applyQuaternion(group.current.quaternion)
        .normalize();
      const remaining = currentDirection.angleTo(targetDirection);
      if (remaining < 0.003 || reducedMotion) {
        camera.position.copy(targetDirection.multiplyScalar(cameraDistance));
        clearCameraTarget();
      } else {
        const rotation = new Quaternion().setFromUnitVectors(
          currentDirection,
          targetDirection,
        );
        const partial = new Quaternion().slerp(
          rotation,
          1 - Math.exp(-delta * 3.2),
        );
        camera.position
          .copy(currentDirection.applyQuaternion(partial))
          .multiplyScalar(cameraDistance);
      }
      camera.lookAt(0, 0, 0);
      invalidate();
    }
  });

  function handleSelect(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    const threshold =
      event.pointerType === 'touch' ? TOUCH_CLICK_DRAG_THRESHOLD_PX : undefined;
    if (!isSelectionGesture(event.delta, threshold)) return;
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
        {showAntipodes ? (
          <>
            <Marker position={primary} color="#e8e0c8" />
            <Marker position={antipode} color="#9cc7b7" />
            <Line
              points={[primary, [0, 0, 0], antipode]}
              color="#b8cfb9"
              lineWidth={1}
              transparent
              opacity={0.4}
              depthTest={false}
            />
          </>
        ) : null}
      </group>
      <OrbitControls
        enablePan={false}
        minDistance={2.15}
        maxDistance={5}
        rotateSpeed={0.55}
        zoomSpeed={0.65}
        onStart={() => {
          clearCameraTarget();
          markInteraction();
        }}
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
