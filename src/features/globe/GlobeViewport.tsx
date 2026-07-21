import {
  Canvas,
  type ThreeEvent,
  useFrame,
  useThree,
} from '@react-three/fiber';
import { Billboard, Line, OrbitControls } from '@react-three/drei';
import {
  useEffect,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type Ref,
  type RefObject,
} from 'react';
import type { Group, PerspectiveCamera, ShaderMaterial } from 'three';
import { Color, MathUtils, Quaternion, Vector3 } from 'three';
import { useAppStore } from '../../state/appStore';
import { useFrameBenchmark } from '../performance/useFrameBenchmark';
import {
  createCountryHighlightTexture,
  createCountryTexture,
  getCountryDataset,
} from './countryData';
import {
  antipodeOf,
  createAntipodeCrossSection,
  createGraticuleLines,
  createLineSegmentPositions,
  geoToVector3,
  markerWorldDiameter,
  vector3ToGeo,
} from './geo';
import {
  CLICK_DRAG_THRESHOLD_PX,
  isSelectionGesture,
  rotateCameraVertically,
  TOUCH_CLICK_DRAG_THRESHOLD_PX,
} from './interaction';
import { detectQualityProfile, type QualityProfile } from './quality';
import {
  GLOBE_COLOR_CONTRACT,
  GLOBE_RENDERING,
  SUNLINE_RENDERING,
} from './rendering';
import { supportsWebGL2 } from './webgl';
import type { GeoPoint } from './geo';
import styles from './GlobeViewport.module.css';

interface GlobeViewportProps {
  diagnosticResetKey: string;
  fallbackLabel: string;
  contextLostLabel: string;
  ariaLabel: string;
  keyboardInstructions: string;
  keyboardMovedLabel: string;
  keyboardZoomedLabel: string;
  keyboardSelectedLabel: string;
  countryFills: ReadonlyMap<string, string> | null;
  showAntipodes: boolean;
  sunline: SunlineRenderState | null;
}

export interface SunlineRenderState {
  subsolarPoint: GeoPoint;
}

interface GlobeKeyboardController {
  rotateHorizontal: (radians: number) => void;
  rotateVertical: (radians: number) => void;
  zoom: (factor: number) => void;
  selectCenter: () => void;
}

export function GlobeViewport({
  diagnosticResetKey,
  fallbackLabel,
  contextLostLabel,
  ariaLabel,
  keyboardInstructions,
  keyboardMovedLabel,
  keyboardZoomedLabel,
  keyboardSelectedLabel,
  countryFills,
  showAntipodes,
  sunline,
}: GlobeViewportProps) {
  const [supported] = useState(supportsWebGL2);
  const [profile] = useState(detectQualityProfile);
  const [contextLost, setContextLost] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const keyboardController = useRef<GlobeKeyboardController>(null);
  const pointerStarts = useRef(new Map<number, { x: number; y: number }>());
  const [keyboardStatus, setKeyboardStatus] = useState('');
  const benchmark = useFrameBenchmark(profile.level);
  const markMeaningfulInteraction = useAppStore(
    (state) => state.markMeaningfulInteraction,
  );
  const setCameraFocusFree = useAppStore((state) => state.setCameraFocusFree);
  const point = useAppStore((state) => state.point);
  const selectedCountry = useAppStore((state) => state.selectedCountry);

  function clearCameraDiagnostic() {
    const element = viewport.current;
    if (!element) return;
    delete element.dataset.cameraFocusTarget;
    delete element.dataset.cameraCenterLatitude;
    delete element.dataset.cameraCenterLongitude;
    delete element.dataset.cameraFocusMotion;
  }

  function recordCameraDiagnostic(
    point: GeoPoint,
    motion: 'instant' | 'animated',
  ) {
    const element = viewport.current;
    if (!element) return;
    const latitude = formatDiagnosticCoordinate(point.latitude);
    const longitude = formatDiagnosticCoordinate(point.longitude);
    element.dataset.cameraFocusTarget = `${latitude},${longitude}`;
    element.dataset.cameraCenterLatitude = latitude;
    element.dataset.cameraCenterLongitude = longitude;
    element.dataset.cameraFocusMotion = motion;
  }

  function recordMarkerDiagnostic(
    globeCameraDistance: number,
    actualCssDiameter: number,
    latitude: number,
    longitude: number,
    reason: MarkerDiagnosticReason,
  ) {
    const element = viewport.current;
    if (!element) return;
    element.dataset.cameraDistance =
      formatDiagnosticCoordinate(globeCameraDistance);
    element.dataset.markerOriginActualCssDiameter =
      actualCssDiameter.toString();
    element.dataset.markerOriginTarget = `${formatDiagnosticCoordinate(latitude)},${formatDiagnosticCoordinate(longitude)}`;
    element.dataset.markerDiagnosticRevision = String(
      Number(element.dataset.markerDiagnosticRevision ?? 0) + 1,
    );
    element.dataset.markerDiagnosticState = 'sampled';
    element.dataset.markerDiagnosticReason = reason;
  }

  function recordSunlineProjectionDiagnostic(
    selected: ProjectedMarkerEvidence,
    solar: ProjectedMarkerEvidence,
    reason: SunlineDiagnosticReason,
  ) {
    const element = viewport.current;
    if (!element) return;
    element.dataset.sunlineSelectedProjectedCenter = `${selected.x},${selected.y}`;
    element.dataset.sunlineSolarProjectedCenter = `${solar.x},${solar.y}`;
    element.dataset.sunlineSelectedFrontFacing = String(selected.frontFacing);
    element.dataset.sunlineSolarFrontFacing = String(solar.frontFacing);
    element.dataset.sunlineDiagnosticRevision = String(
      Number(element.dataset.sunlineDiagnosticRevision ?? 0) + 1,
    );
    element.dataset.sunlineDiagnosticReason = reason;
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    pointerStarts.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const start = pointerStarts.current.get(event.pointerId);
    pointerStarts.current.delete(event.pointerId);
    if (!start) return;
    const distance = Math.hypot(
      event.clientX - start.x,
      event.clientY - start.y,
    );
    const threshold =
      event.pointerType === 'touch'
        ? TOUCH_CLICK_DRAG_THRESHOLD_PX
        : CLICK_DRAG_THRESHOLD_PX;
    if (distance > threshold) {
      clearCameraDiagnostic();
      markMeaningfulInteraction();
      setCameraFocusFree();
    }
  }

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
  useEffect(() => {
    clearCameraDiagnostic();
    const element = viewport.current;
    if (!element) return;
    delete element.dataset.cameraDistance;
    delete element.dataset.markerOriginActualCssDiameter;
    delete element.dataset.markerOriginTarget;
    delete element.dataset.markerDiagnosticRevision;
    delete element.dataset.markerDiagnosticReason;
    if (showAntipodes) {
      element.dataset.markerDiagnosticState = 'idle-rotation';
    } else {
      delete element.dataset.markerDiagnosticState;
    }
  }, [diagnosticResetKey, showAntipodes]);

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
      data-marker-role-count={showAntipodes ? 2 : undefined}
      data-marker-roles={showAntipodes ? 'origin,antipode' : undefined}
      data-marker-center-css-px={showAntipodes ? 3 : undefined}
      data-cross-section-interior-draw-count={showAntipodes ? 1 : undefined}
      data-sunline-marker-geometry={sunline ? 'legacy-sphere-ring' : undefined}
      data-sunline-night-max-alpha={
        sunline ? SUNLINE_RENDERING.night.maxAlpha : undefined
      }
      data-sunline-layer-order={
        sunline ? 'mask,highlight,solar,selected-point' : undefined
      }
      data-sunline-selected-material={
        sunline
          ? materialDiagnostic(SUNLINE_RENDERING.selectedMarker)
          : undefined
      }
      data-sunline-solar-material={
        sunline ? materialDiagnostic(SUNLINE_RENDERING.solarMarker) : undefined
      }
      data-sunline-radius-order={
        sunline ? 'selected>solar>highlight>mask' : undefined
      }
      data-sunline-selected-marker-role={
        sunline ? SUNLINE_RENDERING.selectedMarker.role : undefined
      }
      data-sunline-selected-marker-target={
        sunline
          ? `${formatDiagnosticCoordinate(point.latitude)},${formatDiagnosticCoordinate(point.longitude)}`
          : undefined
      }
      data-selected-country={sunline ? selectedCountry?.name : undefined}
      data-sunline-highlight-country={
        sunline ? selectedCountry?.name : undefined
      }
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={(event) => pointerStarts.current.delete(event.pointerId)}
      onWheel={() => {
        clearCameraDiagnostic();
        markMeaningfulInteraction();
        setCameraFocusFree();
      }}
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
          sunline={sunline}
          onCameraFocusStart={clearCameraDiagnostic}
          onCameraFocusComplete={recordCameraDiagnostic}
          onMarkerDiagnostic={recordMarkerDiagnostic}
          onSunlineProjectionDiagnostic={recordSunlineProjectionDiagnostic}
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
  sunline: SunlineRenderState | null;
  onCameraFocusStart: () => void;
  onCameraFocusComplete: (
    point: GeoPoint,
    motion: 'instant' | 'animated',
  ) => void;
  onMarkerDiagnostic: (
    globeCameraDistance: number,
    actualCssDiameter: number,
    latitude: number,
    longitude: number,
    reason: MarkerDiagnosticReason,
  ) => void;
  onSunlineProjectionDiagnostic: (
    selected: ProjectedMarkerEvidence,
    solar: ProjectedMarkerEvidence,
    reason: SunlineDiagnosticReason,
  ) => void;
}

function GlobeScene({
  profile,
  benchmarkActive,
  recordBenchmarkFrame,
  keyboardController,
  countryFills,
  showAntipodes,
  sunline,
  onCameraFocusStart,
  onCameraFocusComplete,
  onMarkerDiagnostic,
  onSunlineProjectionDiagnostic,
}: GlobeSceneProps) {
  const point = useAppStore((state) => state.point);
  const selectedCountry = useAppStore((state) => state.selectedCountry);
  const hoveredCountry = useAppStore((state) => state.hoveredCountry);
  const cameraTarget = useAppStore((state) => state.cameraFocusIntent.target);
  const hasInteracted = useAppStore((state) => state.hasInteracted);
  const selectPoint = useAppStore((state) => state.selectPoint);
  const markInteraction = useAppStore((state) => state.markInteraction);
  const markMeaningfulInteraction = useAppStore(
    (state) => state.markMeaningfulInteraction,
  );
  const setCameraFocusFree = useAppStore((state) => state.setCameraFocusFree);
  const setSelectedCountry = useAppStore((state) => state.setSelectedCountry);
  const setHoveredCountry = useAppStore((state) => state.setHoveredCountry);
  const clearCameraTarget = useAppStore((state) => state.clearCameraTarget);
  const group = useRef<Group>(null);
  const interactionStart = useRef<Vector3>(null);
  const markerDiagnostic = useRef<MarkerDiagnosticHandle>(null);
  const sunlineDiagnostic = useRef<SunlineDiagnosticHandle>(null);
  const { camera, gl, invalidate } = useThree();
  const maxAnisotropy = gl.capabilities.getMaxAnisotropy();
  const reducedMotion = useReducedMotion();
  const countries = useMemo(() => getCountryDataset(), []);
  const texture = useMemo(
    () =>
      createCountryTexture(
        countries,
        profile.textureWidth,
        countryFills,
        maxAnisotropy,
      ),
    [countries, profile.textureWidth, countryFills, maxAnisotropy],
  );
  const highlights = useMemo(
    () =>
      createCountryHighlightTexture(
        countries,
        profile.textureWidth,
        maxAnisotropy,
      ),
    [countries, profile.textureWidth, maxAnisotropy],
  );

  const primary = useMemo(() => geoToVector3(point, 1.003), [point]);
  const antipode = useMemo(
    () => geoToVector3(antipodeOf(point), 1.0035),
    [point],
  );
  const crossSection = useMemo(
    () => createAntipodeCrossSection(primary),
    [primary],
  );
  const sunDirection = useMemo(
    () =>
      sunline ? geoToVector3(sunline.subsolarPoint).normalize() : new Vector3(),
    [sunline],
  );
  const selectedMarkerPosition = useMemo(
    () => geoToVector3(point, SUNLINE_RENDERING.selectedMarker.radius),
    [point],
  );
  const solarMarkerPosition = useMemo(
    () =>
      sunDirection.clone().multiplyScalar(SUNLINE_RENDERING.solarMarker.radius),
    [sunDirection],
  );

  useImperativeHandle(keyboardController, () => {
    function finishCameraMove() {
      camera.lookAt(0, 0, 0);
      markerDiagnostic.current?.request('interaction');
      sunlineDiagnostic.current?.request('interaction');
      onCameraFocusStart();
      setCameraFocusFree();
      markMeaningfulInteraction();
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
    countries,
    invalidate,
    markMeaningfulInteraction,
    onCameraFocusStart,
    selectPoint,
    setSelectedCountry,
    setCameraFocusFree,
  ]);

  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => () => highlights.texture.dispose(), [highlights]);
  useEffect(() => {
    if (cameraTarget) onCameraFocusStart();
  }, [cameraTarget, onCameraFocusStart]);
  useEffect(() => {
    if (!showAntipodes) return;
    markerDiagnostic.current?.request('point');
    invalidate();
  }, [invalidate, point, showAntipodes]);
  useEffect(() => {
    highlights.update(
      hoveredCountry?.countryId ?? null,
      selectedCountry?.countryId ?? null,
    );
    invalidate();
  }, [
    highlights,
    hoveredCountry?.countryId,
    invalidate,
    selectedCountry?.countryId,
  ]);

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
        markerDiagnostic.current?.request('camera-focus');
        sunlineDiagnostic.current?.request('camera-focus');
        onCameraFocusComplete(
          vector3ToGeo(
            group.current.worldToLocal(camera.position.clone()).normalize(),
          ),
          reducedMotion ? 'instant' : 'animated',
        );
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
    if (!isSelectionGesture(event.delta, threshold)) {
      markMeaningfulInteraction();
      return;
    }
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
      <ambientLight
        intensity={GLOBE_RENDERING.ambient.intensity}
        color={GLOBE_RENDERING.ambient.color}
      />
      <directionalLight
        position={[-3, 2, 4]}
        intensity={GLOBE_RENDERING.directional.intensity}
        color={GLOBE_RENDERING.directional.color}
      />
      <group ref={group}>
        {sunline ? (
          <directionalLight
            position={sunDirection.clone().multiplyScalar(4)}
            intensity={0.28}
            color="#f1d69a"
          />
        ) : null}
        <mesh
          onClick={handleSelect}
          onPointerMove={handleHover}
          onPointerOut={() => setHoveredCountry(null)}
        >
          <sphereGeometry args={[1, ...profile.sphereSegments]} />
          <meshStandardMaterial
            map={texture}
            roughness={GLOBE_RENDERING.material.roughness}
            metalness={GLOBE_RENDERING.material.metalness}
          />
        </mesh>
        <mesh
          scale={sunline ? SUNLINE_RENDERING.highlight.radius : 1.002}
          renderOrder={sunline ? SUNLINE_RENDERING.highlight.renderOrder : 1}
        >
          <sphereGeometry args={[1, ...profile.sphereSegments]} />
          <meshBasicMaterial
            map={highlights.texture}
            transparent
            depthTest={SUNLINE_RENDERING.highlight.depthTest}
            depthWrite={SUNLINE_RENDERING.highlight.depthWrite}
          />
        </mesh>
        <GeographicGraticule sunline={Boolean(sunline)} />
        {sunline ? (
          <>
            <SunlineLayer
              sunDirection={sunDirection}
              sphereSegments={profile.sphereSegments}
            />
            <SunlineProjectionDiagnostic
              ref={sunlineDiagnostic}
              globeGroup={group}
              selectedPosition={selectedMarkerPosition}
              solarPosition={solarMarkerPosition}
              onDiagnostic={onSunlineProjectionDiagnostic}
            />
            <Marker
              position={selectedMarkerPosition}
              color={GLOBE_COLOR_CONTRACT.sunline.selected}
              centerColor={GLOBE_COLOR_CONTRACT.sunline.selected}
              role="selected"
              targetCssPixels={SUNLINE_RENDERING.selectedMarker.cssDiameter}
              renderOrder={SUNLINE_RENDERING.selectedMarker.renderOrder}
              depthTest={SUNLINE_RENDERING.selectedMarker.depthTest}
              depthWrite={SUNLINE_RENDERING.selectedMarker.depthWrite}
            />
          </>
        ) : null}
        {showAntipodes ? (
          <>
            <Marker
              position={primary}
              color={GLOBE_COLOR_CONTRACT.origin.outer}
              centerColor={GLOBE_COLOR_CONTRACT.origin.center}
              role="origin"
              point={point}
              diagnosticHandle={markerDiagnostic}
              onDiagnostic={onMarkerDiagnostic}
            />
            <Marker
              position={antipode}
              color={GLOBE_COLOR_CONTRACT.antipode.outer}
              centerColor={GLOBE_COLOR_CONTRACT.antipode.center}
              role="antipode"
            />
            <AntipodeCrossSection section={crossSection} />
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
          interactionStart.current = camera.position.clone();
          onCameraFocusStart();
          clearCameraTarget();
          markInteraction();
        }}
        onChange={() => invalidate()}
        onEnd={() => {
          if (
            interactionStart.current &&
            interactionStart.current.distanceToSquared(camera.position) > 1e-8
          ) {
            markMeaningfulInteraction();
            setCameraFocusFree();
          }
          interactionStart.current = null;
          markerDiagnostic.current?.request('interaction');
          sunlineDiagnostic.current?.request('interaction');
          invalidate();
        }}
        makeDefault
      />
    </>
  );
}

function formatDiagnosticCoordinate(coordinate: number) {
  return Number(coordinate.toFixed(6)).toString();
}

function GeographicGraticule({ sunline }: { sunline: boolean }) {
  const lines = useMemo(
    () => createGraticuleLines(sunline ? 1.018 : 1.006),
    [sunline],
  );

  return lines.map((line) => (
    <Line
      key={`${line.kind}-${line.coordinate}`}
      points={line.points}
      color={GLOBE_RENDERING.graticule.color}
      lineWidth={line.coordinate === 0 ? 0.85 : 0.55}
      transparent
      opacity={sunline ? 0.42 : GLOBE_RENDERING.graticule.opacity}
      depthTest
      renderOrder={3}
    />
  ));
}

const SUNLINE_VERTEX_SHADER = `
  varying vec3 vObjectNormal;
  void main() {
    vObjectNormal = normalize(normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SUNLINE_FRAGMENT_SHADER = `
  uniform vec3 uSunDirection;
  uniform vec3 uNightColor;
  uniform vec3 uTwilightColor;
  uniform float uNightAlpha;
  varying vec3 vObjectNormal;
  void main() {
    float sunDot = clamp(dot(normalize(vObjectNormal), normalize(uSunDirection)), -1.0, 1.0);
    float altitude = asin(sunDot);
    float twilight = smoothstep(radians(-6.0), 0.0, altitude);
    vec3 color = mix(uNightColor, uTwilightColor, twilight);
    float alpha = mix(uNightAlpha, 0.0, twilight);
    gl_FragColor = vec4(color, alpha);
  }
`;

const AUXILIARY_LATITUDES = [
  { latitude: 0, opacity: 0.45 },
  { latitude: 23.436, opacity: 0.3 },
  { latitude: -23.436, opacity: 0.3 },
  { latitude: 66.564, opacity: 0.22 },
  { latitude: -66.564, opacity: 0.22 },
] as const;

function SunlineLayer({
  sunDirection,
  sphereSegments,
}: {
  sunDirection: Vector3;
  sphereSegments: [number, number];
}) {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uSunDirection: { value: new Vector3() },
      uNightColor: { value: new Color(SUNLINE_RENDERING.night.color) },
      uTwilightColor: { value: new Color(SUNLINE_RENDERING.twilight.color) },
      uNightAlpha: { value: SUNLINE_RENDERING.night.maxAlpha },
    }),
    [],
  );
  const latitudeLines = useMemo(
    () =>
      AUXILIARY_LATITUDES.map(({ latitude, opacity }) => ({
        latitude,
        opacity,
        points: Array.from({ length: 121 }, (_, index) =>
          geoToVector3({ latitude, longitude: -180 + index * 3 }, 1.014),
        ),
      })),
    [],
  );

  useEffect(() => {
    uniforms.uSunDirection.value.copy(sunDirection);
    if (material.current) material.current.uniformsNeedUpdate = true;
  }, [sunDirection, uniforms]);

  useEffect(() => () => material.current?.dispose(), []);

  return (
    <>
      <mesh
        scale={SUNLINE_RENDERING.mask.radius}
        renderOrder={SUNLINE_RENDERING.mask.renderOrder}
      >
        <sphereGeometry args={[1, ...sphereSegments]} />
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={SUNLINE_VERTEX_SHADER}
          fragmentShader={SUNLINE_FRAGMENT_SHADER}
          transparent
          depthTest={SUNLINE_RENDERING.mask.depthTest}
          depthWrite={SUNLINE_RENDERING.mask.depthWrite}
        />
      </mesh>
      {latitudeLines.map((line) => (
        <Line
          key={line.latitude}
          points={line.points}
          color="#d7c58c"
          lineWidth={line.latitude === 0 ? 1.2 : 0.8}
          transparent
          opacity={line.opacity}
          depthTest
        />
      ))}
      <SolarMarker
        position={sunDirection
          .clone()
          .multiplyScalar(SUNLINE_RENDERING.solarMarker.radius)}
        color={GLOBE_COLOR_CONTRACT.sunline.subsolar}
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

type MarkerRole = 'origin' | 'antipode' | 'selected';

interface MarkerDiagnosticHandle {
  request: (reason: MarkerDiagnosticReason) => void;
}

type MarkerDiagnosticReason =
  'point' | 'interaction' | 'camera-focus' | 'resize';

interface ProjectedMarkerEvidence {
  x: number;
  y: number;
  frontFacing: boolean;
}

interface SunlineDiagnosticHandle {
  request: (reason: SunlineDiagnosticReason) => void;
}

type SunlineDiagnosticReason =
  'mount' | 'position' | 'resize' | 'interaction' | 'camera-focus';

const MARKER_TARGET_CSS_PX = 11;
const MARKER_CENTER_RATIO = 3 / MARKER_TARGET_CSS_PX;

function ignoreRaycast() {}

function Marker({
  position,
  color,
  centerColor,
  role,
  point,
  diagnosticHandle,
  onDiagnostic,
  targetCssPixels = MARKER_TARGET_CSS_PX,
  renderOrder = 5,
  depthTest = true,
  depthWrite = false,
}: {
  position: Vector3;
  color: string;
  centerColor: string;
  role: MarkerRole;
  point?: GeoPoint;
  diagnosticHandle?: Ref<MarkerDiagnosticHandle>;
  onDiagnostic?: (
    globeCameraDistance: number,
    actualCssDiameter: number,
    latitude: number,
    longitude: number,
    reason: MarkerDiagnosticReason,
  ) => void;
  targetCssPixels?: number;
  renderOrder?: number;
  depthTest?: boolean;
  depthWrite?: boolean;
}) {
  const marker = useRef<Group>(null);
  const billboard = useRef<Group>(null);
  const worldPosition = useRef(new Vector3());
  const cameraDirection = useRef(new Vector3());
  const cameraOffset = useRef(new Vector3());
  const projectedCenter = useRef(new Vector3());
  const projectedRadius = useRef(new Vector3());
  const diagnosticPending = useRef<MarkerDiagnosticReason | null>(null);
  const { camera, size, invalidate } = useThree();
  const diagnosticSize = useRef(`${size.width}x${size.height}`);

  useImperativeHandle(diagnosticHandle, () => ({
    request(reason) {
      diagnosticPending.current = reason;
    },
  }));

  useEffect(() => {
    if (!diagnosticHandle) return;
    const nextSize = `${size.width}x${size.height}`;
    if (diagnosticSize.current === nextSize) return;
    diagnosticSize.current = nextSize;
    diagnosticPending.current = 'resize';
    invalidate();
  }, [diagnosticHandle, invalidate, size.height, size.width]);

  useFrame(() => {
    const group = marker.current;
    if (!group) return;
    group.getWorldPosition(worldPosition.current);
    camera.getWorldDirection(cameraDirection.current);
    cameraOffset.current.subVectors(worldPosition.current, camera.position);
    const projectionDepth = cameraOffset.current.dot(cameraDirection.current);
    const verticalFov = (camera as PerspectiveCamera).fov;
    const diameter = markerWorldDiameter(
      targetCssPixels,
      projectionDepth,
      verticalFov,
      size.height,
    );
    group.scale.setScalar(diameter);
    if (diagnosticPending.current) {
      const billboardGroup = billboard.current;
      if (!billboardGroup || !point) return;
      billboardGroup.updateWorldMatrix(true, false);
      projectedCenter.current
        .set(0, 0, 0)
        .applyMatrix4(billboardGroup.matrixWorld)
        .project(camera);
      projectedRadius.current
        .set(0.5, 0, 0)
        .applyMatrix4(billboardGroup.matrixWorld)
        .project(camera);
      const actualCssDiameter = Math.hypot(
        (projectedRadius.current.x - projectedCenter.current.x) * size.width,
        (projectedRadius.current.y - projectedCenter.current.y) * size.height,
      );
      const reason = diagnosticPending.current;
      diagnosticPending.current = null;
      onDiagnostic?.(
        camera.position.length(),
        actualCssDiameter,
        point.latitude,
        point.longitude,
        reason,
      );
    }
  });

  return (
    <group
      ref={marker}
      position={[position.x, position.y, position.z]}
      renderOrder={renderOrder}
    >
      <Billboard ref={billboard}>
        <mesh raycast={ignoreRaycast} renderOrder={renderOrder}>
          <circleGeometry args={[MARKER_CENTER_RATIO / 2, 24]} />
          <meshBasicMaterial
            color={centerColor}
            depthTest={depthTest}
            depthWrite={depthWrite}
          />
        </mesh>
        <mesh raycast={ignoreRaycast} renderOrder={renderOrder}>
          <ringGeometry args={[0.39, 0.5, role === 'antipode' ? 4 : 32]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.95}
            side={2}
            depthTest={depthTest}
            depthWrite={depthWrite}
          />
        </mesh>
        {role === 'origin' ? (
          <>
            <mesh
              position={[0.32, 0, 0]}
              raycast={ignoreRaycast}
              renderOrder={renderOrder}
            >
              <planeGeometry args={[0.2, 0.07]} />
              <meshBasicMaterial color={color} />
            </mesh>
            <mesh
              position={[-0.32, 0, 0]}
              raycast={ignoreRaycast}
              renderOrder={renderOrder}
            >
              <planeGeometry args={[0.2, 0.07]} />
              <meshBasicMaterial color={color} />
            </mesh>
          </>
        ) : null}
      </Billboard>
    </group>
  );
}

const SunlineProjectionDiagnostic = forwardRef(
  function SunlineProjectionDiagnostic(
    {
      globeGroup,
      selectedPosition,
      solarPosition,
      onDiagnostic,
    }: {
      globeGroup: RefObject<Group | null>;
      selectedPosition: Vector3;
      solarPosition: Vector3;
      onDiagnostic: (
        selected: ProjectedMarkerEvidence,
        solar: ProjectedMarkerEvidence,
        reason: SunlineDiagnosticReason,
      ) => void;
    },
    ref: Ref<SunlineDiagnosticHandle>,
  ) {
    const pending = useRef<SunlineDiagnosticReason | null>('mount');
    const selectedWorld = useRef(new Vector3());
    const solarWorld = useRef(new Vector3());
    const surfaceNormal = useRef(new Vector3());
    const cameraOffset = useRef(new Vector3());
    const projected = useRef(new Vector3());
    const { camera, size, invalidate } = useThree();
    const diagnosticSize = useRef(`${size.width}x${size.height}`);

    useImperativeHandle(ref, () => ({
      request(reason) {
        pending.current = reason;
      },
    }));
    useEffect(() => {
      pending.current = 'position';
      invalidate();
    }, [invalidate, selectedPosition, solarPosition]);
    useEffect(() => {
      const nextSize = `${size.width}x${size.height}`;
      if (diagnosticSize.current === nextSize) return;
      diagnosticSize.current = nextSize;
      pending.current = 'resize';
      invalidate();
    }, [invalidate, size.height, size.width]);

    useFrame(() => {
      if (!pending.current) return;
      const group = globeGroup.current;
      if (!group) return;
      group.updateWorldMatrix(true, false);
      selectedWorld.current
        .copy(selectedPosition)
        .applyMatrix4(group.matrixWorld);
      solarWorld.current.copy(solarPosition).applyMatrix4(group.matrixWorld);
      const reason = pending.current;
      pending.current = null;
      onDiagnostic(
        projectMarkerEvidence(
          selectedWorld.current,
          camera as PerspectiveCamera,
          size.width,
          size.height,
          surfaceNormal.current,
          cameraOffset.current,
          projected.current,
        ),
        projectMarkerEvidence(
          solarWorld.current,
          camera as PerspectiveCamera,
          size.width,
          size.height,
          surfaceNormal.current,
          cameraOffset.current,
          projected.current,
        ),
        reason,
      );
    });

    return null;
  },
);

function projectMarkerEvidence(
  worldPosition: Vector3,
  camera: PerspectiveCamera,
  width: number,
  height: number,
  surfaceNormal: Vector3,
  cameraOffset: Vector3,
  projected: Vector3,
): ProjectedMarkerEvidence {
  surfaceNormal.copy(worldPosition).normalize();
  cameraOffset.subVectors(camera.position, worldPosition);
  projected.copy(worldPosition).project(camera);
  return {
    x: Number((((projected.x + 1) * width) / 2).toFixed(3)),
    y: Number((((1 - projected.y) * height) / 2).toFixed(3)),
    frontFacing: surfaceNormal.dot(cameraOffset) > 0,
  };
}

function materialDiagnostic(material: {
  depthTest: boolean;
  depthWrite: boolean;
  renderOrder: number;
}) {
  return `depthTest:${material.depthTest},depthWrite:${material.depthWrite},renderOrder:${material.renderOrder}`;
}

function SolarMarker({
  position,
  color,
}: {
  position: Vector3;
  color: string;
}) {
  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh renderOrder={SUNLINE_RENDERING.solarMarker.renderOrder}>
        <sphereGeometry args={[0.025, 20, 20]} />
        <meshBasicMaterial
          color={color}
          depthTest={SUNLINE_RENDERING.solarMarker.depthTest}
          depthWrite={SUNLINE_RENDERING.solarMarker.depthWrite}
        />
      </mesh>
      <Billboard>
        <mesh renderOrder={SUNLINE_RENDERING.solarMarker.renderOrder}>
          <ringGeometry args={[0.04, 0.052, 28]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.7}
            side={2}
            depthTest={SUNLINE_RENDERING.solarMarker.depthTest}
            depthWrite={SUNLINE_RENDERING.solarMarker.depthWrite}
          />
        </mesh>
      </Billboard>
    </group>
  );
}

function AntipodeCrossSection({
  section,
}: {
  section: ReturnType<typeof createAntipodeCrossSection>;
}) {
  const interiorPositions = useMemo(
    () => createLineSegmentPositions(section.interiorSegments),
    [section],
  );

  return (
    <>
      {section.surfaceSegments.map((points, index) => (
        <Line
          key={`surface-${index}`}
          points={points}
          color={GLOBE_COLOR_CONTRACT.crossSection.surface}
          lineWidth={1.2}
          transparent
          opacity={1}
          depthTest
          raycast={ignoreRaycast}
        />
      ))}
      <lineSegments raycast={ignoreRaycast}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[interiorPositions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={GLOBE_COLOR_CONTRACT.crossSection.interior}
          transparent
          opacity={0.52}
          depthTest={false}
          depthWrite={false}
        />
      </lineSegments>
      <mesh position={section.center} raycast={ignoreRaycast}>
        <sphereGeometry args={[0.012, 12, 12]} />
        <meshBasicMaterial
          color={GLOBE_COLOR_CONTRACT.crossSection.center}
          transparent
          opacity={0.72}
          depthTest={false}
        />
      </mesh>
    </>
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
