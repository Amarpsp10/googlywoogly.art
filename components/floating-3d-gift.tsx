"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment, MeshDistortMaterial, Sparkles } from "@react-three/drei";
import { useRef, Suspense } from "react";
import * as THREE from "three";

function GiftBox() {
  const boxRef = useRef<THREE.Group>(null);
  const ribbonRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (boxRef.current) {
      boxRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
    }
    if (ribbonRef.current) {
      ribbonRef.current.rotation.z =
        Math.sin(state.clock.elapsedTime * 2) * 0.1;
    }
  });

  return (
    <Float
      speed={2}
      rotationIntensity={0.5}
      floatIntensity={1}
      floatingRange={[-0.2, 0.2]}
    >
      <group ref={boxRef}>
        {/* Main Gift Box */}
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.5, 1.5, 1.5]} />
          <MeshDistortMaterial
            color="#FFB3C6"
            roughness={0.3}
            metalness={0.1}
            distort={0.1}
            speed={2}
          />
        </mesh>

        {/* Box Lid */}
        <mesh position={[0, 0.85, 0]} castShadow>
          <boxGeometry args={[1.6, 0.2, 1.6]} />
          <meshStandardMaterial color="#FF8FAB" roughness={0.3} metalness={0.1} />
        </mesh>

        {/* Horizontal Ribbon */}
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.25, 1.55, 1.55]} />
          <meshStandardMaterial color="#B8F4D0" roughness={0.2} metalness={0.3} />
        </mesh>

        {/* Vertical Ribbon */}
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[1.55, 1.55, 0.25]} />
          <meshStandardMaterial color="#B8F4D0" roughness={0.2} metalness={0.3} />
        </mesh>

        {/* Bow Center */}
        <mesh ref={ribbonRef} position={[0, 1.05, 0]} castShadow>
          <sphereGeometry args={[0.2, 32, 32]} />
          <meshStandardMaterial color="#FFE566" roughness={0.2} metalness={0.5} />
        </mesh>

        {/* Bow Left Loop */}
        <mesh position={[-0.35, 1.15, 0]} rotation={[0, 0, -0.5]} castShadow>
          <torusGeometry args={[0.2, 0.08, 16, 32]} />
          <meshStandardMaterial color="#FFE566" roughness={0.2} metalness={0.5} />
        </mesh>

        {/* Bow Right Loop */}
        <mesh position={[0.35, 1.15, 0]} rotation={[0, 0, 0.5]} castShadow>
          <torusGeometry args={[0.2, 0.08, 16, 32]} />
          <meshStandardMaterial color="#FFE566" roughness={0.2} metalness={0.5} />
        </mesh>

        {/* Ribbon Tails */}
        <mesh position={[-0.2, 0.95, 0.15]} rotation={[0.3, 0.2, -0.3]} castShadow>
          <boxGeometry args={[0.1, 0.4, 0.02]} />
          <meshStandardMaterial color="#FFE566" roughness={0.2} metalness={0.5} />
        </mesh>
        <mesh position={[0.2, 0.95, 0.15]} rotation={[0.3, -0.2, 0.3]} castShadow>
          <boxGeometry args={[0.1, 0.4, 0.02]} />
          <meshStandardMaterial color="#FFE566" roughness={0.2} metalness={0.5} />
        </mesh>
      </group>
    </Float>
  );
}

function FloatingHeart({ position }: { position: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.5;
      meshRef.current.position.y =
        position[1] + Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.2;
    }
  });

  return (
    <mesh ref={meshRef} position={position} scale={0.2}>
      <sphereGeometry args={[1, 32, 32]} />
      <MeshDistortMaterial
        color="#E0C6FF"
        roughness={0.2}
        metalness={0.3}
        distort={0.3}
        speed={3}
      />
    </mesh>
  );
}

function FloatingStar({ position }: { position: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.z = state.clock.elapsedTime * 2;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
  });

  return (
    <mesh ref={meshRef} position={position} scale={0.15}>
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color="#FFE566"
        roughness={0.1}
        metalness={0.8}
        emissive="#FFE566"
        emissiveIntensity={0.3}
      />
    </mesh>
  );
}

function Scene() {
  return (
    <>
      <Environment preset="studio" />
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
      <pointLight position={[-5, 5, -5]} intensity={0.5} color="#FFB3C6" />

      <GiftBox />

      {/* Floating decorative elements */}
      <FloatingHeart position={[-2, 0.5, -1]} />
      <FloatingHeart position={[2, -0.3, -0.5]} />
      <FloatingStar position={[-1.5, 1.2, 0.5]} />
      <FloatingStar position={[1.8, 0.8, -0.5]} />
      <FloatingStar position={[0, -1, 1]} />

      {/* Sparkles */}
      <Sparkles
        count={50}
        scale={6}
        size={3}
        speed={0.5}
        color="#FFE566"
        opacity={0.6}
      />
    </>
  );
}

export function Floating3DGift() {
  return (
    <div className="w-full h-full min-h-[400px]">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}
