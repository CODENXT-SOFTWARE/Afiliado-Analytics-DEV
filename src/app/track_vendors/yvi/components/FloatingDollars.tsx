"use client";

import React, { useMemo, Suspense, useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text3D, Center, PresentationControls } from "@react-three/drei";
import * as THREE from "three";
import { useTheme } from "@/app/components/theme/ThemeProvider";

function Dollar({ position, rotation, scale, delay, entryDelay, isLight }: {
  position: [number, number, number],
  rotation: [number, number, number],
  scale: number,
  delay: number,
  entryDelay: number,
  isLight: boolean
}) {
  const meshRef = useRef<THREE.Group>(null);
  const groupRef = useRef<THREE.Group>(null);
  const currentScale = useRef(0);

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    // Lógica de surgimento suave (Lerp)
    if (time > entryDelay) {
      // Fator de suavização para o crescimento (2.5 controla a velocidade do surgimento)
      currentScale.current = THREE.MathUtils.lerp(currentScale.current, scale, 0.04);
    }

    if (groupRef.current) {
      groupRef.current.scale.setScalar(currentScale.current);
    }

    if (meshRef.current) {
      // Animação de flutuação contínua - Velocidade reduzida para reflexos mais estáveis
      const floatTime = time + delay;
      meshRef.current.rotation.y = rotation[1] + Math.sin(floatTime * 0.8) * 0.45;
      meshRef.current.rotation.x = rotation[0] + Math.cos(floatTime * 0.6) * 0.05;
    }
  });

  return (
    <group position={position} ref={groupRef}>
      <PresentationControls
        global={false}
        cursor={true}
        snap={true}
        speed={2}
        zoom={1}
        rotation={[0, 0, 0]}
        polar={[-Math.PI / 4, Math.PI / 4]}
        azimuth={[-Math.PI / 4, Math.PI / 4]}
      >
        <Center scale={1}> {/* Escala controlada pelo lerp no groupRef */}
          <group ref={meshRef} rotation={rotation}>
            <Text3D
              font="https://unpkg.com/three@0.150.1/examples/fonts/helvetiker_bold.typeface.json"
              size={1}
              height={0.22}
              curveSegments={12}
              bevelEnabled
              bevelThickness={0.04}
              bevelSize={0.02}
              bevelOffset={0}
              bevelSegments={4}
            >
              $
              <meshStandardMaterial
                color={isLight ? "#EE4D2D" : "#ff6b35"}
                metalness={isLight ? 0.3 : 0.5}
                roughness={isLight ? 0.2 : 0.15}
                emissive={isLight ? "#EE4D2D" : "#ff6b35"}
                emissiveIntensity={isLight ? 0.5 : 0.15}
              />
            </Text3D>
          </group>
        </Center>
      </PresentationControls>
    </group>
  );
}

const FIXED_DOLLARS: { position: [number, number, number], rotation: [number, number, number], scale: number }[] = [
  { position: [-3.2, 2.5, 0], rotation: [0.2, 0.4, 0.1], scale: 0.50 },
  { position: [2.8, 2.7, 0], rotation: [0.2, -0.4, -0.5], scale: 0.45 },
  { position: [-3.0, -0.4, -0.5], rotation: [0, 0.6, 0.2], scale: 0.4 },
  { position: [3.0, -1.5, 0.5], rotation: [0, -0.6, -0.4], scale: 0.55 },
  { position: [-2.4, -2.7, 0], rotation: [-0.1, 0.5, 0.4], scale: 0.55 },
  { position: [-1.0, 3.1, 0.4], rotation: [0.3, 0.2, 0], scale: 0.38 },
];

export default function FloatingDollars() {
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const delays = useMemo(() => FIXED_DOLLARS.map(() => Math.random() * 10), []);

  // Delays de entrada sequenciais (Staggered)
  // Eles começam a aparecer um após o outro com intervalo de 0.4s
  const entryDelays = useMemo(() => FIXED_DOLLARS.map((_, i) => 1.5 + i * 0.6), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div
      className="absolute inset-0 z-20 bg-transparent transition-opacity duration-700 ease-in"
      style={{
        height: '180%',
        top: '-40%',
        left: '-40%',
        width: '180%',
        opacity: mounted ? 1 : 0
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 10], fov: 45 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={isLight ? 2.0 : 1.4} />
          {/* Luz Principal (Key Light) */}
          <directionalLight position={[5, 5, 5]} intensity={isLight ? 3.0 : 1.7} color="#ffffff" />
          
          {/* Luz de Preenchimento Lateral */}
          <pointLight position={[-10, 5, 2]} intensity={isLight ? 2.5 : 2.9} color="#ffffff" />
          
          {/* Luz Frontal Seguidora (Camera-like) - Crucial para nunca ficar escuro na frente */}
          <pointLight position={[0, 0, 15]} intensity={isLight ? 5.0 : 1.2} color="#ffffff" />
          <pointLight position={[0, 0, -10]} intensity={isLight ? 1.0 : 0.5} color="#ffffff" />

          {FIXED_DOLLARS.map((props, i) => (
            <Dollar
              key={i}
              {...props}
              delay={delays[i]}
              entryDelay={entryDelays[i]}
              isLight={isLight}
            />
          ))}
        </Suspense>
      </Canvas>
    </div>
  );
}
