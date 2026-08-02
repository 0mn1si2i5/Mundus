import {
  Canvas,
  type ThreeEvent,
  useFrame,
  useThree,
} from '@react-three/fiber';
import { Billboard, Line, OrbitControls } from '@react-three/drei';
import {
  useEffect,
  useCallback,
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
import type {
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  ShaderMaterial,
} from 'three';
import {
  BackSide,
  Color,
  FrontSide,
  MathUtils,
  Quaternion,
  Vector3,
} from 'three';
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
  ANTIPODE_DRAG_RENDERING,
  GLOBE_COLOR_CONTRACT,
  GLOBE_RENDERING,
  SUNLINE_RENDERING,
} from './rendering';
import { supportsWebGL2 } from './webgl';
import type { GeoPoint } from './geo';
import styles from './GlobeViewport.module.css';
import type { AntipodeRelation } from '../antipodes/relation';
import {
  AntipodeRelationLayer,
  type AntipodeRelationDiagnosticHandle,
  type AntipodeRelationDiagnosticReason,
} from './AntipodeRelationLayer';
import { cssPixelsToWorldUnits } from './screenSpace';
import { VectorGlobeLayer, type VectorGlobeState } from './VectorGlobeLayer';
import type { VectorGlobeResources } from './vectorGlobe';
import {
  CAMERA_FOCUS_DURATION_MS,
  cameraFocusAnimationProgress,
  clampGlobeCameraDistance,
  GLOBE_CAMERA_DISTANCE,
} from './camera';

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
  antipodeRelation: AntipodeRelation | null;
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

interface PointerStart {
  x: number;
  y: number;
  pointerType: string;
  dragging: boolean;
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
  antipodeRelation,
}: GlobeViewportProps) {
  const [supported] = useState(supportsWebGL2);
  const [profile] = useState(detectQualityProfile);
  const [dragDiagnosticsEnabled] = useState(() =>
    new URLSearchParams(window.location.search).has('dragDiagnostics'),
  );
  const [contextLost, setContextLost] = useState(false);
  const [vectorRenderSampleKey, setVectorRenderSampleKey] = useState(0);
  const [vectorState, setVectorState] = useState<VectorGlobeState>('loading');
  const [vectorPaletteVersion, setVectorPaletteVersion] = useState(0);
  const [vectorGeometryId, setVectorGeometryId] = useState('');
  const [vectorDragTransparent, setVectorDragTransparent] = useState(false);
  const [vectorDragEvidence, setVectorDragEvidence] = useState('');
  const [vectorDragOrderEvidence, setVectorDragOrderEvidence] = useState('');
  const [vectorSunlineHighlight, setVectorSunlineHighlight] = useState<
    string | null
  >(null);
  const [vectorRenderEvidence, setVectorRenderEvidence] = useState<{
    vectorDraws: number;
    rendererCalls: number;
    revision: number;
  } | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const keyboardController = useRef<GlobeKeyboardController>(null);
  const [pointerStarts] = useState(() => new Map<number, PointerStart>());
  const [antipodeDragActive, setAntipodeDragActive] = useState(false);
  const [dragModeActive, setDragModeActive] = useState(showAntipodes);
  const [keyboardStatus, setKeyboardStatus] = useState('');
  const benchmark = useFrameBenchmark(profile.level);
  const markMeaningfulInteraction = useAppStore(
    (state) => state.markMeaningfulInteraction,
  );
  const setCameraFocusFree = useAppStore((state) => state.setCameraFocusFree);
  const point = useAppStore((state) => state.point);
  const selectedCountry = useAppStore((state) => state.selectedCountry);
  const antipodeDragVisible = showAntipodes && antipodeDragActive;
  const handleVectorStateChange = useCallback(
    (state: VectorGlobeState, resources: VectorGlobeResources | null) => {
      setVectorState(state);
      setVectorGeometryId(resources?.surface.uuid ?? '');
    },
    [],
  );
  const handleVectorDragEvidence = useCallback(
    (alphaEvidence: string, orderEvidence: string) => {
      setVectorDragEvidence(alphaEvidence);
      setVectorDragOrderEvidence(orderEvidence);
    },
    [],
  );
  if (dragModeActive !== showAntipodes) {
    pointerStarts.clear();
    setAntipodeDragActive(false);
    setDragModeActive(showAntipodes);
  }

  function clearCameraDiagnostic() {
    const element = viewport.current;
    if (!element) return;
    delete element.dataset.cameraFocusTarget;
    delete element.dataset.cameraCenterLatitude;
    delete element.dataset.cameraCenterLongitude;
    delete element.dataset.cameraFocusMotion;
    delete element.dataset.cameraFocusStartedAt;
    delete element.dataset.cameraFocusElapsedMs;
    delete element.dataset.cameraFocusCompletedRevision;
    element.dataset.cameraFocusState = 'idle';
  }

  function recordCameraDiagnostic(
    point: GeoPoint,
    motion: 'instant' | 'animated',
    elapsedMs: number,
  ) {
    const element = viewport.current;
    if (!element) return;
    const latitude = formatDiagnosticCoordinate(point.latitude);
    const longitude = formatDiagnosticCoordinate(point.longitude);
    element.dataset.cameraFocusTarget = `${latitude},${longitude}`;
    element.dataset.cameraCenterLatitude = latitude;
    element.dataset.cameraCenterLongitude = longitude;
    element.dataset.cameraFocusMotion = motion;
    element.dataset.cameraFocusElapsedMs = Math.round(elapsedMs).toString();
    element.dataset.cameraFocusCompletedRevision =
      element.dataset.cameraFocusRequestRevision ?? '0';
    element.dataset.cameraFocusState = 'complete';
  }

  function recordCameraFocusStart(timestamp: number) {
    clearCameraDiagnostic();
    const element = viewport.current;
    if (!element) return;
    element.dataset.cameraFocusStartedAt = timestamp.toString();
    element.dataset.cameraFocusState = 'animating';
    element.dataset.cameraFocusRequestRevision = String(
      Number(element.dataset.cameraFocusRequestRevision ?? 0) + 1,
    );
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
    selectedSurface: ProjectedMarkerEvidence,
    solar: ProjectedMarkerEvidence,
    reason: SunlineDiagnosticReason,
  ) {
    const element = viewport.current;
    if (!element) return;
    element.dataset.sunlineSelectedProjectedCenter = `${selected.x},${selected.y}`;
    element.dataset.sunlineSelectedSurfaceProjectedCenter = `${selectedSurface.x},${selectedSurface.y}`;
    element.dataset.sunlineSolarProjectedCenter = `${solar.x},${solar.y}`;
    element.dataset.sunlineSelectedFrontFacing = String(selected.frontFacing);
    element.dataset.sunlineSolarFrontFacing = String(solar.frontFacing);
    element.dataset.sunlineDiagnosticRevision = String(
      Number(element.dataset.sunlineDiagnosticRevision ?? 0) + 1,
    );
    element.dataset.sunlineDiagnosticReason = reason;
  }

  function recordCenterGlowFrame(revision: number) {
    const element = viewport.current;
    if (!element || !showAntipodes) return;
    element.dataset.antipodeCenterGlowRevision = String(revision);
  }

  function recordCenterGlowMode(mode: 'static' | 'deterministic') {
    const element = viewport.current;
    if (!element || !showAntipodes) return;
    element.dataset.antipodeCenterGlowFlicker = mode;
  }

  function recordAntipodeSceneDiagnostic(
    outer: AntipodeMaterialEvidence,
    inner: AntipodeMaterialEvidence,
  ) {
    const element = viewport.current;
    if (!element || !showAntipodes) return;
    element.dataset.antipodeOuterMaterial = materialEvidenceDiagnostic(outer);
    element.dataset.antipodeInnerMaterial = materialEvidenceDiagnostic(inner);
    element.dataset.antipodeHitSphere = 'enabled';
  }

  function recordAntipodeLayerDiagnostic(
    base: string,
    dragShellVisible: string,
    highlight: string,
  ) {
    const element = viewport.current;
    if (!element || !showAntipodes) return;
    element.dataset.antipodeBaseSurface = base;
    element.dataset.antipodeDragShellVisible = dragShellVisible;
    element.dataset.antipodeHighlight = highlight;
  }

  function recordHitSpherePick() {
    const element = viewport.current;
    if (!element || !showAntipodes) return;
    element.dataset.antipodeHitSpherePickRevision = String(
      Number(element.dataset.antipodeHitSpherePickRevision ?? 0) + 1,
    );
  }

  function recordGlobePick(point: GeoPoint) {
    const element = viewport.current;
    if (!element) return;
    element.dataset.globeLastPickTarget = `${formatDiagnosticCoordinate(point.latitude)},${formatDiagnosticCoordinate(point.longitude)}`;
    element.dataset.globePickRevision = String(
      Number(element.dataset.globePickRevision ?? 0) + 1,
    );
  }

  function recordAntipodeRelationArcCount(count: number | null) {
    const element = viewport.current;
    if (!element) return;
    if (count === null) {
      delete element.dataset.antipodeRelationDiagnosticSource;
      delete element.dataset.antipodeRelationArcCount;
      return;
    }
    element.dataset.antipodeRelationDiagnosticSource = 'measured';
    element.dataset.antipodeRelationArcCount = String(count);
  }

  function recordAntipodeRelationFocusEvidence(evidence: string) {
    const element = viewport.current;
    if (!element || !showAntipodes) return;
    if (evidence.startsWith('arcPoints:')) {
      const markerEvidence = element.dataset.antipodeRelationFocusEvidence;
      element.dataset.antipodeRelationFocusEvidence = markerEvidence
        ? `${markerEvidence},${evidence}`
        : evidence;
    } else {
      element.dataset.antipodeRelationFocusEvidence = evidence;
    }
  }

  function recordAntipodeCityMarkerSize(
    role: 'origin-city' | 'antipode-city',
    cssPixels: number | null,
    reason?: AntipodeRelationDiagnosticReason,
  ) {
    const element = viewport.current;
    if (!element) return;
    if (cssPixels === null) {
      if (role === 'origin-city') {
        delete element.dataset.markerOriginCityActualCssDiameter;
      } else {
        delete element.dataset.markerAntipodeCityActualCssDiameter;
      }
      if (
        !element.dataset.markerOriginCityActualCssDiameter &&
        !element.dataset.markerAntipodeCityActualCssDiameter
      ) {
        delete element.dataset.antipodeRelationDiagnosticRevision;
        delete element.dataset.antipodeRelationDiagnosticReason;
      }
      return;
    }
    const value = Number(cssPixels.toFixed(3)).toString();
    if (role === 'origin-city') {
      element.dataset.markerOriginCityActualCssDiameter = value;
    } else {
      element.dataset.markerAntipodeCityActualCssDiameter = value;
    }
    element.dataset.antipodeRelationDiagnosticRevision = String(
      Number(element.dataset.antipodeRelationDiagnosticRevision ?? 0) + 1,
    );
    if (reason) element.dataset.antipodeRelationDiagnosticReason = reason;
  }

  function syncDragActive() {
    const active = Array.from(pointerStarts.values()).some(
      (pointer) => pointer.dragging,
    );
    setAntipodeDragActive((current) => (current === active ? current : active));
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    pointerStarts.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      pointerType: event.pointerType,
      dragging: false,
    });
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = pointerStarts.get(event.pointerId);
    if (!start || start.dragging) return;
    const threshold =
      start.pointerType === 'touch'
        ? TOUCH_CLICK_DRAG_THRESHOLD_PX
        : CLICK_DRAG_THRESHOLD_PX;
    if (
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > threshold
    ) {
      start.dragging = true;
      syncDragActive();
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const start = pointerStarts.get(event.pointerId);
    pointerStarts.delete(event.pointerId);
    syncDragActive();
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
      pointerStarts.clear();
      setAntipodeDragActive(false);
      setContextLost(true);
    };
    const restored = () => {
      setContextLost(false);
      setVectorRenderSampleKey((value) => value + 1);
    };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    return () => {
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
    };
  }, [pointerStarts]);
  useEffect(() => {
    const pointers = pointerStarts;
    const clear = () => {
      pointers.clear();
      setAntipodeDragActive(false);
    };
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('blur', clear);
      pointers.clear();
    };
  }, [pointerStarts]);
  useEffect(() => {
    clearCameraDiagnostic();
    const element = viewport.current;
    if (!element) return;
    delete element.dataset.cameraDistance;
    delete element.dataset.markerOriginActualCssDiameter;
    delete element.dataset.markerOriginTarget;
    delete element.dataset.markerDiagnosticRevision;
    delete element.dataset.markerDiagnosticReason;
    delete element.dataset.antipodeRelationFocusEvidence;
    if (showAntipodes) {
      element.dataset.markerDiagnosticState = 'idle-rotation';
    } else {
      delete element.dataset.markerDiagnosticState;
      delete element.dataset.antipodeOuterMaterial;
      delete element.dataset.antipodeInnerMaterial;
      delete element.dataset.antipodeHitSphere;
      delete element.dataset.antipodeHitSpherePickRevision;
    }
  }, [diagnosticResetKey, showAntipodes]);

  const relationReady = Boolean(
    antipodeRelation?.origin.nearestMajorCity &&
    antipodeRelation.antipode.nearestMajorCity,
  );

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
      data-vector-detail={profile.vectorDetail}
      data-vector-state={vectorState}
      data-vector-geometry-id={vectorGeometryId || undefined}
      data-vector-palette-version={
        vectorState === 'ready' ? vectorPaletteVersion : undefined
      }
      data-vector-raster-fallback-visible={String(vectorState !== 'ready')}
      data-vector-render-draws={vectorRenderEvidence?.vectorDraws}
      data-vector-renderer-calls={vectorRenderEvidence?.rendererCalls}
      data-vector-render-revision={vectorRenderEvidence?.revision}
      data-vector-drag-transparent={
        vectorState === 'ready' ? String(vectorDragTransparent) : undefined
      }
      data-vector-drag-effective-alpha={vectorDragEvidence || undefined}
      data-vector-drag-render-order={
        vectorState === 'ready' && antipodeDragVisible
          ? vectorDragOrderEvidence || undefined
          : undefined
      }
      data-vector-sunline-highlight={vectorSunlineHighlight ?? undefined}
      data-marker-role-count={
        showAntipodes ? (relationReady ? 4 : 2) : undefined
      }
      data-marker-roles={
        showAntipodes
          ? relationReady
            ? 'origin,antipode,origin-city,antipode-city'
            : 'origin,antipode'
          : undefined
      }
      data-antipode-relation-state={
        showAntipodes ? (relationReady ? 'ready' : 'pending') : undefined
      }
      data-antipode-city-shapes={
        showAntipodes && relationReady ? 'square,triangle' : undefined
      }
      data-marker-center-css-px={showAntipodes ? 3 : undefined}
      data-cross-section-interior-draw-count={showAntipodes ? 1 : undefined}
      data-antipode-drag-state={
        showAntipodes
          ? antipodeDragVisible
            ? 'active'
            : 'inactive'
          : undefined
      }
      data-antipode-inner-wall-visible={
        showAntipodes ? String(antipodeDragVisible) : undefined
      }
      data-antipode-center-glow-visible={
        showAntipodes ? String(antipodeDragVisible) : undefined
      }
      data-antipode-center-glow-flicker={
        showAntipodes && antipodeDragVisible
          ? 'pending'
          : showAntipodes
            ? 'off'
            : undefined
      }
      data-antipode-center-glow-revision={showAntipodes ? '0' : undefined}
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
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={(event) => {
        pointerStarts.delete(event.pointerId);
        syncDragActive();
      }}
      onLostPointerCapture={(event) => {
        pointerStarts.delete(event.pointerId);
        syncDragActive();
      }}
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
          antipodeDragActive={antipodeDragVisible}
          dragDiagnosticsEnabled={dragDiagnosticsEnabled}
          sunline={sunline}
          antipodeRelation={antipodeRelation}
          onCameraFocusStart={clearCameraDiagnostic}
          onCameraFocusAnimationStart={recordCameraFocusStart}
          onCameraFocusComplete={recordCameraDiagnostic}
          onMarkerDiagnostic={recordMarkerDiagnostic}
          onSunlineProjectionDiagnostic={recordSunlineProjectionDiagnostic}
          onCenterGlowFrame={recordCenterGlowFrame}
          onCenterGlowMode={recordCenterGlowMode}
          onAntipodeSceneDiagnostic={recordAntipodeSceneDiagnostic}
          onAntipodeLayerDiagnostic={recordAntipodeLayerDiagnostic}
          onHitSpherePick={recordHitSpherePick}
          onGlobePick={recordGlobePick}
          onAntipodeRelationArcCount={recordAntipodeRelationArcCount}
          onAntipodeRelationFocusEvidence={recordAntipodeRelationFocusEvidence}
          onAntipodeCityMarkerSize={recordAntipodeCityMarkerSize}
          onVectorStateChange={handleVectorStateChange}
          onVectorPaletteUpdate={setVectorPaletteVersion}
          onVectorDragMaterialChange={setVectorDragTransparent}
          onVectorSunlineHighlightChange={setVectorSunlineHighlight}
          onVectorDragEvidence={handleVectorDragEvidence}
          onVectorRenderEvidence={(vectorDraws, rendererCalls) =>
            setVectorRenderEvidence((current) => ({
              vectorDraws,
              rendererCalls,
              revision: (current?.revision ?? 0) + 1,
            }))
          }
          vectorRenderSampleKey={vectorRenderSampleKey}
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
  antipodeDragActive: boolean;
  dragDiagnosticsEnabled: boolean;
  sunline: SunlineRenderState | null;
  antipodeRelation: AntipodeRelation | null;
  onCameraFocusStart: () => void;
  onCameraFocusAnimationStart: (timestamp: number) => void;
  onCameraFocusComplete: (
    point: GeoPoint,
    motion: 'instant' | 'animated',
    elapsedMs: number,
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
    selectedSurface: ProjectedMarkerEvidence,
    solar: ProjectedMarkerEvidence,
    reason: SunlineDiagnosticReason,
  ) => void;
  onCenterGlowFrame: (revision: number) => void;
  onCenterGlowMode: (mode: 'static' | 'deterministic') => void;
  onAntipodeSceneDiagnostic: (
    outer: AntipodeMaterialEvidence,
    inner: AntipodeMaterialEvidence,
  ) => void;
  onAntipodeLayerDiagnostic: (
    base: string,
    dragShellVisible: string,
    highlight: string,
  ) => void;
  onHitSpherePick: () => void;
  onGlobePick: (point: GeoPoint) => void;
  onAntipodeRelationArcCount: (count: number | null) => void;
  onAntipodeRelationFocusEvidence: (evidence: string) => void;
  onAntipodeCityMarkerSize: (
    role: 'origin-city' | 'antipode-city',
    cssPixels: number | null,
    reason?: AntipodeRelationDiagnosticReason,
  ) => void;
  onVectorStateChange: (
    state: VectorGlobeState,
    resources: VectorGlobeResources | null,
  ) => void;
  onVectorPaletteUpdate: (version: number) => void;
  onVectorDragMaterialChange: (transparent: boolean) => void;
  onVectorDragEvidence: (alphaEvidence: string, orderEvidence: string) => void;
  onVectorSunlineHighlightChange: (evidence: string | null) => void;
  onVectorRenderEvidence: (vectorDraws: number, rendererCalls: number) => void;
  vectorRenderSampleKey: number;
}

interface AntipodeMaterialEvidence {
  side: number;
  depthWrite: boolean;
  renderOrder: number;
  radius: number;
}

function GlobeScene({
  profile,
  benchmarkActive,
  recordBenchmarkFrame,
  keyboardController,
  countryFills,
  showAntipodes,
  antipodeDragActive,
  dragDiagnosticsEnabled,
  sunline,
  antipodeRelation,
  onCameraFocusStart,
  onCameraFocusAnimationStart,
  onCameraFocusComplete,
  onMarkerDiagnostic,
  onSunlineProjectionDiagnostic,
  onCenterGlowFrame,
  onCenterGlowMode,
  onAntipodeSceneDiagnostic,
  onAntipodeLayerDiagnostic,
  onHitSpherePick,
  onGlobePick,
  onAntipodeRelationArcCount,
  onAntipodeRelationFocusEvidence,
  onAntipodeCityMarkerSize,
  onVectorStateChange,
  onVectorPaletteUpdate,
  onVectorDragMaterialChange,
  onVectorDragEvidence,
  onVectorSunlineHighlightChange,
  onVectorRenderEvidence,
  vectorRenderSampleKey,
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
  const cameraFocusAnimation = useRef<{
    target: GeoPoint;
    startedAt: number;
    startDirection: Vector3;
    targetDirection: Vector3;
  } | null>(null);
  const cameraFocusRequest = useRef<{
    target: GeoPoint;
    startedAt: number;
  } | null>(null);
  const markerDiagnostic = useRef<MarkerDiagnosticHandle>(null);
  const antipodeRelationDiagnostic =
    useRef<AntipodeRelationDiagnosticHandle>(null);
  const sunlineDiagnostic = useRef<SunlineDiagnosticHandle>(null);
  const outerShell = useRef<Mesh>(null);
  const outerMaterial = useRef<MeshStandardMaterial>(null);
  const baseSurface = useRef<Mesh>(null);
  const baseMaterial = useRef<MeshStandardMaterial>(null);
  const highlightMesh = useRef<Mesh>(null);
  const highlightMaterial = useRef<MeshBasicMaterial>(null);
  const innerWall = useRef<Mesh>(null);
  const innerMaterial = useRef<MeshBasicMaterial>(null);
  const [vectorReady, setVectorReady] = useState(false);
  const { camera, gl, invalidate } = useThree();
  const onCameraFocusStartRef = useRef(onCameraFocusStart);
  const onCameraFocusAnimationStartRef = useRef(onCameraFocusAnimationStart);
  const invalidateRef = useRef(invalidate);
  useEffect(() => {
    onCameraFocusStartRef.current = onCameraFocusStart;
    onCameraFocusAnimationStartRef.current = onCameraFocusAnimationStart;
    invalidateRef.current = invalidate;
  }, [invalidate, onCameraFocusAnimationStart, onCameraFocusStart]);
  const reducedMotion = useReducedMotion();
  const maxAnisotropy = gl.capabilities.getMaxAnisotropy();
  const countries = useMemo(() => getCountryDataset(), []);
  const rasterCountryFills = vectorReady ? null : countryFills;
  const texture = useMemo(
    () =>
      createCountryTexture(
        countries,
        profile.textureWidth,
        rasterCountryFills,
        maxAnisotropy,
      ),
    [countries, profile.textureWidth, rasterCountryFills, maxAnisotropy],
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
  const handleVectorStateChange = useCallback(
    (state: VectorGlobeState, resources: VectorGlobeResources | null) => {
      setVectorReady(state === 'ready');
      onVectorStateChange(state, resources);
    },
    [onVectorStateChange],
  );

  const relationOrigin = antipodeRelation?.origin.exactPoint ?? point;
  const relationAntipode =
    antipodeRelation?.antipode.exactPoint ?? antipodeOf(point);
  const primary = useMemo(
    () => geoToVector3(relationOrigin, 1.003),
    [relationOrigin],
  );
  const antipode = useMemo(
    () => geoToVector3(relationAntipode, 1.0035),
    [relationAntipode],
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
      camera.updateMatrixWorld();
      markerDiagnostic.current?.request('interaction');
      antipodeRelationDiagnostic.current?.request('interaction');
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
          clampGlobeCameraDistance(camera.position.length() * factor),
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
    if (!cameraTarget) {
      cameraFocusRequest.current = null;
      cameraFocusAnimation.current = null;
      return;
    }
    cameraFocusRequest.current = {
      target: cameraTarget,
      startedAt: performance.now(),
    };
    onCameraFocusAnimationStartRef.current(
      cameraFocusRequest.current.startedAt,
    );
    let frame = 0;
    const startedAt = cameraFocusRequest.current.startedAt;
    const requestFocusFrame = (timestamp: number) => {
      invalidateRef.current();
      if (timestamp - startedAt <= CAMERA_FOCUS_DURATION_MS) {
        frame = requestAnimationFrame(requestFocusFrame);
      }
    };
    frame = requestAnimationFrame(requestFocusFrame);
    return () => cancelAnimationFrame(frame);
  }, [cameraTarget]);
  useEffect(() => {
    if (!showAntipodes) return;
    markerDiagnostic.current?.request('point');
    antipodeRelationDiagnostic.current?.request('point');
    invalidate();
  }, [invalidate, point, showAntipodes]);
  useEffect(() => {
    invalidate();
  }, [antipodeDragActive, invalidate]);
  useEffect(() => {
    if (!showAntipodes) return;
    const outerMesh = outerShell.current;
    const outer = outerMaterial.current;
    const innerMesh = innerWall.current;
    const inner = innerMaterial.current;
    const baseMesh = baseSurface.current;
    const base = baseMaterial.current;
    const highlight = highlightMesh.current;
    const highlightSurface = highlightMaterial.current;
    if (
      !outerMesh ||
      !outer ||
      !innerMesh ||
      !inner ||
      !baseMesh ||
      !base ||
      !highlight ||
      !highlightSurface
    )
      return;
    onAntipodeSceneDiagnostic(
      {
        side: outer.side,
        depthWrite: outer.depthWrite,
        renderOrder: outerMesh.renderOrder,
        radius: outerMesh.scale.x,
      },
      {
        side: inner.side,
        depthWrite: inner.depthWrite,
        renderOrder: innerMesh.renderOrder,
        radius: innerMesh.scale.x,
      },
    );
    onAntipodeLayerDiagnostic(
      `visible:${!antipodeDragActive && (vectorReady || baseMesh.visible)},transparent:${base.transparent},depthWrite:${base.depthWrite},renderOrder:${baseMesh.renderOrder},radius:${baseMesh.scale.x}`,
      String(antipodeDragActive && (vectorReady || outerMesh.visible)),
      `visible:${vectorReady || highlight.visible},renderOrder:${highlight.renderOrder},radius:${highlight.scale.x},depthWrite:${highlightSurface.depthWrite}`,
    );
  }, [
    antipodeDragActive,
    onAntipodeLayerDiagnostic,
    onAntipodeSceneDiagnostic,
    showAntipodes,
    vectorReady,
  ]);
  useEffect(() => {
    if (vectorReady) return;
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
    vectorReady,
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
      const cameraDistance = clampGlobeCameraDistance(camera.position.length());
      const currentDirection = camera.position.clone().normalize();
      if (cameraFocusAnimation.current?.target !== cameraTarget) {
        cameraFocusAnimation.current = {
          target: cameraTarget,
          startedAt:
            cameraFocusRequest.current?.target === cameraTarget
              ? cameraFocusRequest.current.startedAt
              : performance.now(),
          startDirection: currentDirection,
          targetDirection: geoToVector3(cameraTarget)
            .applyQuaternion(group.current.quaternion)
            .normalize(),
        };
      }
      const animation = cameraFocusAnimation.current;
      animation.targetDirection
        .copy(geoToVector3(cameraTarget))
        .applyQuaternion(group.current.quaternion)
        .normalize();
      const { progress, complete } = cameraFocusAnimationProgress(
        animation.startedAt,
        performance.now(),
      );
      const targetDirection = animation.targetDirection;
      const remaining = currentDirection.angleTo(targetDirection);
      if (complete || remaining < 0.003 || reducedMotion) {
        camera.position.copy(targetDirection.multiplyScalar(cameraDistance));
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
        markerDiagnostic.current?.request('camera-focus');
        antipodeRelationDiagnostic.current?.request(
          'camera-focus',
          cameraTarget,
        );
        sunlineDiagnostic.current?.request('camera-focus');
        onCameraFocusComplete(
          vector3ToGeo(
            group.current.worldToLocal(camera.position.clone()).normalize(),
          ),
          reducedMotion ? 'instant' : 'animated',
          performance.now() - animation.startedAt,
        );
        const originCity =
          antipodeRelation?.origin.nearestMajorCity?.city.point;
        const antipodeCity =
          antipodeRelation?.antipode.nearestMajorCity?.city.point;
        const matchesTarget = (candidate: GeoPoint | undefined) =>
          candidate?.latitude === cameraTarget.latitude &&
          candidate.longitude === cameraTarget.longitude;
        const focusedSide =
          matchesTarget(relationOrigin) || matchesTarget(originCity)
            ? antipodeRelation?.origin
            : matchesTarget(relationAntipode) || matchesTarget(antipodeCity)
              ? antipodeRelation?.antipode
              : null;
        if (focusedSide?.nearestMajorCity) {
          const focusedCity = matchesTarget(
            focusedSide.nearestMajorCity.city.point,
          );
          const markerPoint = focusedCity
            ? focusedSide.nearestMajorCity.city.point
            : focusedSide.exactPoint;
          const markerRadius = focusedCity
            ? 1.021
            : focusedSide === antipodeRelation?.antipode
              ? 1.0035
              : 1.003;
          group.current.updateWorldMatrix(true, false);
          camera.updateMatrixWorld();
          const markerWorld = geoToVector3(
            markerPoint,
            markerRadius,
          ).applyMatrix4(group.current.matrixWorld);
          const marker = markerWorld.clone().project(camera);
          const markerFrontFacing =
            markerWorld
              .clone()
              .normalize()
              .dot(camera.position.clone().sub(markerWorld)) > 0;
          const inViewport = (projected: Vector3) =>
            projected.z >= -1 &&
            projected.z <= 1 &&
            Math.abs(projected.x) <= 1 &&
            Math.abs(projected.y) <= 1;
          onAntipodeRelationFocusEvidence(
            `markerTarget:${formatDiagnosticCoordinate(markerPoint.latitude)},${formatDiagnosticCoordinate(markerPoint.longitude)},markerRadius:${markerRadius},markerFrontFacing:${markerFrontFacing},markerInViewport:${inViewport(marker)}`,
          );
        }
        clearCameraTarget(cameraTarget);
        cameraFocusAnimation.current = null;
      } else {
        const rotation = new Quaternion().setFromUnitVectors(
          animation.startDirection,
          targetDirection,
        );
        const partial = new Quaternion().slerp(rotation, progress);
        camera.position
          .copy(animation.startDirection.clone().applyQuaternion(partial))
          .multiplyScalar(cameraDistance);
      }
      camera.lookAt(0, 0, 0);
      invalidate();
    }
  });

  function handleSelect(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    onHitSpherePick();
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
    onGlobePick(selectedPoint);
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
          onPointerEnter={onHitSpherePick}
          onClick={handleSelect}
          onPointerMove={handleHover}
          onPointerOut={() => setHoveredCountry(null)}
        >
          <sphereGeometry args={[1, ...profile.sphereSegments]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <VectorGlobeLayer
          profile={profile}
          countryFills={countryFills}
          hoveredCountryId={hoveredCountry?.countryId ?? null}
          selectedCountryId={selectedCountry?.countryId ?? null}
          dragActive={antipodeDragActive}
          onStateChange={handleVectorStateChange}
          onPaletteUpdate={onVectorPaletteUpdate}
          onDragMaterialChange={onVectorDragMaterialChange}
          onDragEvidence={onVectorDragEvidence}
          sunlineActive={Boolean(sunline)}
          onSunlineHighlightChange={onVectorSunlineHighlightChange}
          onRenderEvidence={onVectorRenderEvidence}
          renderSampleKey={vectorRenderSampleKey}
        />
        <mesh
          ref={baseSurface}
          visible={!vectorReady && !antipodeDragActive}
          renderOrder={0}
          raycast={ignoreRaycast}
        >
          <sphereGeometry args={[1, ...profile.sphereSegments]} />
          <meshStandardMaterial
            ref={baseMaterial}
            map={texture}
            roughness={GLOBE_RENDERING.material.roughness}
            metalness={GLOBE_RENDERING.material.metalness}
            depthTest
            depthWrite
          />
        </mesh>
        <mesh
          ref={outerShell}
          visible={!vectorReady && antipodeDragActive}
          renderOrder={ANTIPODE_DRAG_RENDERING.outerShell.renderOrder}
          raycast={ignoreRaycast}
        >
          <sphereGeometry args={[1, ...profile.sphereSegments]} />
          <meshStandardMaterial
            ref={outerMaterial}
            map={texture}
            roughness={GLOBE_RENDERING.material.roughness}
            metalness={GLOBE_RENDERING.material.metalness}
            color={ANTIPODE_DRAG_RENDERING.outerShell.color}
            transparent
            opacity={ANTIPODE_DRAG_RENDERING.outerShell.dragOpacity}
            side={ANTIPODE_DRAG_RENDERING.outerShell.side}
            depthTest={ANTIPODE_DRAG_RENDERING.outerShell.depthTest}
            depthWrite={ANTIPODE_DRAG_RENDERING.outerShell.depthWrite}
          />
        </mesh>
        <mesh
          ref={innerWall}
          visible={antipodeDragActive}
          scale={ANTIPODE_DRAG_RENDERING.innerWall.radius}
          renderOrder={ANTIPODE_DRAG_RENDERING.innerWall.renderOrder}
          raycast={ignoreRaycast}
        >
          <sphereGeometry args={[1, ...profile.sphereSegments]} />
          <meshBasicMaterial
            ref={innerMaterial}
            color={ANTIPODE_DRAG_RENDERING.innerWall.color}
            transparent
            opacity={ANTIPODE_DRAG_RENDERING.innerWall.opacity}
            side={ANTIPODE_DRAG_RENDERING.innerWall.side}
            depthTest={ANTIPODE_DRAG_RENDERING.innerWall.depthTest}
            depthWrite={ANTIPODE_DRAG_RENDERING.innerWall.depthWrite}
          />
        </mesh>
        <mesh
          ref={highlightMesh}
          visible={!vectorReady}
          scale={
            sunline
              ? SUNLINE_RENDERING.highlight.radius
              : ANTIPODE_DRAG_RENDERING.highlight.radius
          }
          renderOrder={
            sunline
              ? SUNLINE_RENDERING.highlight.renderOrder
              : ANTIPODE_DRAG_RENDERING.highlight.renderOrder
          }
          raycast={ignoreRaycast}
        >
          <sphereGeometry args={[1, ...profile.sphereSegments]} />
          <meshBasicMaterial
            ref={highlightMaterial}
            map={highlights.texture}
            transparent
            depthTest
            depthWrite={false}
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
              selectedSurfacePosition={primary}
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
              point={relationOrigin}
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
            {antipodeRelation ? (
              <AntipodeRelationLayer
                ref={antipodeRelationDiagnostic}
                relation={antipodeRelation}
                onArcCount={onAntipodeRelationArcCount}
                onMarkerSize={onAntipodeCityMarkerSize}
                onFocusEvidence={onAntipodeRelationFocusEvidence}
              />
            ) : null}
            <CenterCandleGlow
              active={antipodeDragActive}
              reducedMotion={reducedMotion}
              diagnosticsEnabled={dragDiagnosticsEnabled}
              onFrame={onCenterGlowFrame}
              onMode={onCenterGlowMode}
            />
          </>
        ) : null}
      </group>
      <OrbitControls
        enablePan={false}
        minDistance={GLOBE_CAMERA_DISTANCE.min}
        maxDistance={GLOBE_CAMERA_DISTANCE.max}
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
          antipodeRelationDiagnostic.current?.request('interaction');
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
  const worldPosition = useRef(new Vector3());
  const cameraDirection = useRef(new Vector3());
  const cameraOffset = useRef(new Vector3());
  const cameraRight = useRef(new Vector3());
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
    const diameter = cssPixelsToWorldUnits(
      targetCssPixels,
      projectionDepth,
      verticalFov,
      size.height,
    );
    group.scale.setScalar(diameter);
    if (diagnosticPending.current) {
      if (!point) return;
      cameraRight.current.setFromMatrixColumn(camera.matrixWorld, 0);
      projectedCenter.current.copy(worldPosition.current).project(camera);
      projectedRadius.current
        .copy(worldPosition.current)
        .addScaledVector(cameraRight.current, diameter / 2)
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
      <Billboard>
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
      selectedSurfacePosition,
      solarPosition,
      onDiagnostic,
    }: {
      globeGroup: RefObject<Group | null>;
      selectedPosition: Vector3;
      selectedSurfacePosition: Vector3;
      solarPosition: Vector3;
      onDiagnostic: (
        selected: ProjectedMarkerEvidence,
        selectedSurface: ProjectedMarkerEvidence,
        solar: ProjectedMarkerEvidence,
        reason: SunlineDiagnosticReason,
      ) => void;
    },
    ref: Ref<SunlineDiagnosticHandle>,
  ) {
    const pending = useRef<SunlineDiagnosticReason | null>('mount');
    const selectedWorld = useRef(new Vector3());
    const selectedSurfaceWorld = useRef(new Vector3());
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
    }, [invalidate, selectedPosition, selectedSurfacePosition, solarPosition]);
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
      selectedSurfaceWorld.current
        .copy(selectedSurfacePosition)
        .normalize()
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
          selectedSurfaceWorld.current,
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

function materialEvidenceDiagnostic(material: AntipodeMaterialEvidence) {
  const side =
    material.side === FrontSide
      ? 'FrontSide'
      : material.side === BackSide
        ? 'BackSide'
        : String(material.side);
  return `side:${side},depthWrite:${material.depthWrite},renderOrder:${material.renderOrder},radius:${material.radius}`;
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
          depthWrite={ANTIPODE_DRAG_RENDERING.centerNode.depthWrite}
        />
      </mesh>
    </>
  );
}

function CenterCandleGlow({
  active,
  reducedMotion,
  diagnosticsEnabled,
  onFrame,
  onMode,
}: {
  active: boolean;
  reducedMotion: boolean;
  diagnosticsEnabled: boolean;
  onFrame: (revision: number) => void;
  onMode: (mode: 'static' | 'deterministic') => void;
}) {
  const core = useRef<Mesh>(null);
  const halo = useRef<Mesh>(null);
  const coreMaterial = useRef<MeshBasicMaterial>(null);
  const haloMaterial = useRef<MeshBasicMaterial>(null);
  const frameRevision = useRef(0);
  const lastReportedAt = useRef(0);
  const { invalidate, setFrameloop } = useThree();

  useFrame(({ clock }) => {
    if (!active || reducedMotion) return;
    frameRevision.current += 1;
    const flicker =
      1 +
      ANTIPODE_DRAG_RENDERING.centerGlow.flickerAmplitude *
        (0.62 * Math.sin(clock.elapsedTime * 11.3) +
          0.38 * Math.sin(clock.elapsedTime * 17.1 + 0.7));
    core.current?.scale.setScalar(flicker);
    halo.current?.scale.setScalar(2 - flicker);
    if (coreMaterial.current) {
      coreMaterial.current.opacity =
        ANTIPODE_DRAG_RENDERING.centerGlow.core.opacity * flicker;
    }
    if (haloMaterial.current) {
      haloMaterial.current.opacity =
        ANTIPODE_DRAG_RENDERING.centerGlow.halo.opacity * flicker;
    }
    if (
      diagnosticsEnabled &&
      clock.elapsedTime - lastReportedAt.current >= 0.1
    ) {
      lastReportedAt.current = clock.elapsedTime;
      onFrame(frameRevision.current);
    }
    invalidate();
  });

  useEffect(() => {
    if (active) onMode(reducedMotion ? 'static' : 'deterministic');
    if (active) {
      frameRevision.current = 0;
      lastReportedAt.current = -Infinity;
      invalidate();
    }
    if (active && !reducedMotion) return;
    core.current?.scale.setScalar(1);
    halo.current?.scale.setScalar(1);
    if (coreMaterial.current) {
      coreMaterial.current.opacity =
        ANTIPODE_DRAG_RENDERING.centerGlow.core.opacity;
    }
    if (haloMaterial.current) {
      haloMaterial.current.opacity =
        ANTIPODE_DRAG_RENDERING.centerGlow.halo.opacity;
    }
  }, [active, diagnosticsEnabled, invalidate, onMode, reducedMotion]);
  useEffect(() => {
    setFrameloop(active && !reducedMotion ? 'always' : 'demand');
    return () => setFrameloop('demand');
  }, [active, reducedMotion, setFrameloop]);

  return (
    <group
      visible={active}
      renderOrder={ANTIPODE_DRAG_RENDERING.centerGlow.renderOrder}
    >
      <mesh ref={core} raycast={ignoreRaycast}>
        <sphereGeometry
          args={[ANTIPODE_DRAG_RENDERING.centerGlow.core.radius, 16, 16]}
        />
        <meshBasicMaterial
          ref={coreMaterial}
          color={ANTIPODE_DRAG_RENDERING.centerGlow.core.color}
          transparent
          opacity={ANTIPODE_DRAG_RENDERING.centerGlow.core.opacity}
          depthTest={ANTIPODE_DRAG_RENDERING.centerGlow.core.depthTest}
          depthWrite={ANTIPODE_DRAG_RENDERING.centerGlow.core.depthWrite}
        />
      </mesh>
      <mesh ref={halo} raycast={ignoreRaycast}>
        <sphereGeometry
          args={[ANTIPODE_DRAG_RENDERING.centerGlow.halo.radius, 20, 20]}
        />
        <meshBasicMaterial
          ref={haloMaterial}
          color={ANTIPODE_DRAG_RENDERING.centerGlow.halo.color}
          transparent
          opacity={ANTIPODE_DRAG_RENDERING.centerGlow.halo.opacity}
          depthTest={ANTIPODE_DRAG_RENDERING.centerGlow.halo.depthTest}
          depthWrite={ANTIPODE_DRAG_RENDERING.centerGlow.halo.depthWrite}
        />
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
