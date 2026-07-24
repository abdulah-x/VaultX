"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Icosahedron, Float, MeshDistortMaterial } from "@react-three/drei";
import type { Mesh, Group } from "three";

/**
 * The landing hero's 3D object.
 *
 * This module is the ONLY place three.js is imported. It is loaded through a
 * dynamic() boundary in HeroVisual so the ~150KB runtime is code-split into its
 * own chunk and never reaches an app route -- the dashboard must stay instant.
 */

function Knot() {
  const mesh = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    // Rotate by elapsed delta rather than a fixed step per frame, so the speed
    // is the same on a 60Hz and a 144Hz display.
    mesh.current.rotation.y += delta * 0.18;
    mesh.current.rotation.x += delta * 0.05;
  });

  return (
    <Float speed={1.2} rotationIntensity={0.25} floatIntensity={0.6}>
      <Icosahedron ref={mesh} args={[1.35, 6]}>
        <MeshDistortMaterial
          color="#6366f1"
          emissive="#8b5cf6"
          emissiveIntensity={0.35}
          roughness={0.18}
          metalness={0.85}
          distort={0.32}
          speed={1.4}
        />
      </Icosahedron>
    </Float>
  );
}

/** A slow orbiting ring of points, to give the object a sense of scale. */
function Particles({ count = 220 }: { count?: number }) {
  const group = useRef<Group>(null);

  const positions = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let i = 0; i < count; i++) {
      // Fibonacci sphere — even distribution without the clustering at the
      // poles that naive random spherical coordinates produce.
      const y = 1 - (i / (count - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = i * 2.399963229728653;
      const r = 2.6 + Math.random() * 0.7;
      out.push([Math.cos(theta) * radius * r, y * r, Math.sin(theta) * radius * r]);
    }
    return out;
  }, [count]);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y -= delta * 0.04;
  });

  return (
    <group ref={group}>
      {positions.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.018, 6, 6]} />
          <meshBasicMaterial color="#06b6d4" transparent opacity={0.55} />
        </mesh>
      ))}
    </group>
  );
}

export default function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5.5], fov: 45 }}
      // Cap the pixel ratio: on a 3x phone screen an uncapped canvas renders
      // nine times the pixels for no visible gain.
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[4, 4, 4]} intensity={1.6} />
      <directionalLight position={[-4, -2, -3]} intensity={0.5} color="#06b6d4" />
      <Knot />
      <Particles />
    </Canvas>
  );
}
