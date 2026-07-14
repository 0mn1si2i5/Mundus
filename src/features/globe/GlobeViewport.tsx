import {
  Canvas,
  type ThreeEvent,
  useFrame,
  useThree,
} from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Group } from 'three';
import { AdditiveBlending, BackSide, Color, type Vector3 } from 'three';
import { useAppStore } from '../../state/appStore';
import { antipodeOf, geoToVector3, vector3ToGeo } from './geo';
import { supportsWebGL2 } from './webgl';
import styles from './GlobeViewport.module.css';

interface GlobeViewportProps {
  fallbackLabel: string;
}

export function GlobeViewport({ fallbackLabel }: GlobeViewportProps) {
  const [supported] = useState(supportsWebGL2);

  if (!supported) {
    return (
      <section className={styles.unavailable} role="status">
        <div className={styles.staticGlobe} />
        <p>{fallbackLabel}</p>
      </section>
    );
  }

  return (
    <div className={styles.viewport} aria-label="Interactive globe">
      <Canvas
        dpr={[1, 1.75]}
        frameloop="demand"
        camera={{ position: [0, 0.15, 3.25], fov: 38, near: 0.1, far: 100 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
      >
        <GlobeScene />
      </Canvas>
    </div>
  );
}

function GlobeScene() {
  const point = useAppStore((state) => state.point);
  const hasInteracted = useAppStore((state) => state.hasInteracted);
  const selectPoint = useAppStore((state) => state.selectPoint);
  const markInteraction = useAppStore((state) => state.markInteraction);
  const group = useRef<Group>(null);
  const { invalidate } = useThree();
  const reducedMotion = useReducedMotion();

  const primary = useMemo(() => geoToVector3(point, 1.025), [point]);
  const antipode = useMemo(
    () => geoToVector3(antipodeOf(point), 1.025),
    [point],
  );

  useFrame((_, delta) => {
    if (!hasInteracted && !reducedMotion && group.current) {
      group.current.rotation.y += delta * 0.035;
      invalidate();
    }
  });

  function handleSelect(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    selectPoint(vector3ToGeo(event.point));
    invalidate();
  }

  return (
    <>
      <ambientLight intensity={0.85} color="#8ca0a4" />
      <directionalLight position={[-3, 2, 4]} intensity={3.2} color="#dfe7d5" />
      <Stars radius={30} depth={18} count={550} factor={1.1} fade speed={0} />
      <group ref={group}>
        <mesh onClick={handleSelect}>
          <sphereGeometry args={[1, 96, 64]} />
          <meshStandardMaterial
            color={new Color('#17262a')}
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
