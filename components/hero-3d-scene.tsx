"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import { useRef, useMemo } from "react";
import type { Mesh, Group } from "three";

// Simple 3D Gift Box Component
function GiftBox({
  position,
  color,
  ribbonColor,
  scale = 1,
  rotationSpeed = 0.005,
}: {
  position: [number, number, number];
  color: string;
  ribbonColor: string;
  scale?: number;
  rotationSpeed?: number;
}) {
  const meshRef = useRef<Group>(null);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += rotationSpeed;
      meshRef.current.rotation.x += rotationSpeed * 0.5;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
      <group ref={meshRef} position={position} scale={scale}>
        {/* Main box */}
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {/* Ribbon horizontal */}
        <mesh position={[0, 0, 0.51]}>
          <boxGeometry args={[0.2, 1.02, 0.02]} />
          <meshStandardMaterial color={ribbonColor} />
        </mesh>
        <mesh position={[0, 0, -0.51]}>
          <boxGeometry args={[0.2, 1.02, 0.02]} />
          <meshStandardMaterial color={ribbonColor} />
        </mesh>
        <mesh position={[0.51, 0, 0]}>
          <boxGeometry args={[0.02, 1.02, 0.2]} />
          <meshStandardMaterial color={ribbonColor} />
        </mesh>
        <mesh position={[-0.51, 0, 0]}>
          <boxGeometry args={[0.02, 1.02, 0.2]} />
          <meshStandardMaterial color={ribbonColor} />
        </mesh>
        {/* Ribbon vertical */}
        <mesh position={[0, 0.51, 0]}>
          <boxGeometry args={[1.02, 0.02, 0.2]} />
          <meshStandardMaterial color={ribbonColor} />
        </mesh>
        <mesh position={[0, 0.51, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[1.02, 0.02, 0.2]} />
          <meshStandardMaterial color={ribbonColor} />
        </mesh>
        {/* Bow */}
        <mesh position={[0, 0.7, 0]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshStandardMaterial color={ribbonColor} />
        </mesh>
        <mesh position={[0.2, 0.65, 0]} rotation={[0, 0, -0.5]}>
          <capsuleGeometry args={[0.08, 0.2, 4, 8]} />
          <meshStandardMaterial color={ribbonColor} />
        </mesh>
        <mesh position={[-0.2, 0.65, 0]} rotation={[0, 0, 0.5]}>
          <capsuleGeometry args={[0.08, 0.2, 4, 8]} />
          <meshStandardMaterial color={ribbonColor} />
        </mesh>
      </group>
    </Float>
  );
}

// Floating blob/sphere decoration
function FloatingBlob({
  position,
  color,
  scale = 1,
}: {
  position: [number, number, number];
  color: string;
  scale?: number;
}) {
  const meshRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = clock.getElapsedTime() * 0.2;
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.3;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={1}>
      <mesh ref={meshRef} position={position} scale={scale}>
        <icosahedronGeometry args={[1, 4]} />
        <MeshDistortMaterial
          color={color}
          speed={2}
          distort={0.3}
          radius={1}
          transparent
          opacity={0.7}
        />
      </mesh>
    </Float>
  );
}

// Sparkle/Star particle
function Sparkle({ position }: { position: [number, number, number] }) {
  const meshRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const scale = 0.5 + Math.sin(clock.getElapsedTime() * 2 + position[0]) * 0.3;
      meshRef.current.scale.setScalar(scale);
    }
  });

  return (
    <Float speed={3} floatIntensity={0.5}>
      <mesh ref={meshRef} position={position}>
        <octahedronGeometry args={[0.1]} />
        <meshStandardMaterial
          color="#FFE566"
          emissive="#FFE566"
          emissiveIntensity={0.5}
        />
      </mesh>
    </Float>
  );
}

export default function Hero3DScene() {
  // Generate random sparkle positions
  const sparklePositions = useMemo(() => {
    return Array.from({ length: 15 }, () => [
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 4 - 2,
    ] as [number, number, number]);
  }, []);

  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 45 }}
      style={{ background: "transparent" }}
      dpr={[1, 1.5]}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <pointLight position={[-5, 5, -5]} intensity={0.4} color="#FFB3C6" />

      {/* Gift Boxes scattered around */}
      <GiftBox
        position={[-4, 2, -2]}
        color="#FFB3C6"
        ribbonColor="#FF8FAB"
        scale={0.6}
        rotationSpeed={0.003}
      />
      <GiftBox
        position={[4.5, -1.5, -3]}
        color="#B8F4D0"
        ribbonColor="#7DE8B0"
        scale={0.5}
        rotationSpeed={0.004}
      />
      <GiftBox
        position={[-3.5, -2, -1]}
        color="#FFE566"
        ribbonColor="#FFD700"
        scale={0.45}
        rotationSpeed={0.005}
      />
      <GiftBox
        position={[3.5, 2.5, -2]}
        color="#E0C6FF"
        ribbonColor="#C9A0FF"
        scale={0.55}
        rotationSpeed={0.0035}
      />
      <GiftBox
        position={[-5, 0, -4]}
        color="#FFCBA4"
        ribbonColor="#FFB380"
        scale={0.4}
        rotationSpeed={0.004}
      />
      <GiftBox
        position={[5, 1, -3]}
        color="#A8E6FF"
        ribbonColor="#7DD4FF"
        scale={0.35}
        rotationSpeed={0.006}
      />

      {/* Floating decorative blobs */}
      <FloatingBlob position={[-2, 3, -5]} color="#FFB3C6" scale={0.4} />
      <FloatingBlob position={[3, -2, -4]} color="#B8F4D0" scale={0.3} />
      <FloatingBlob position={[0, -3, -6]} color="#E0C6FF" scale={0.5} />

      {/* Sparkles */}
      {sparklePositions.map((pos, i) => (
        <Sparkle key={i} position={pos} />
      ))}
    </Canvas>
  );
}
