"use client";

import { useEffect, useMemo, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadFull } from "tsparticles";
import type { ISourceOptions } from "@tsparticles/engine";
import { useTheme } from "../theme/ThemeProvider";

/**
 * NasaParticles - Componente que implementa o fundo "NASA" da biblioteca particles.js
 * utilizando a versão moderna tsparticles para React.
 */
export default function NasaParticles() {
  const [init, setInit] = useState(false);
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Inicializa o motor de partículas uma única vez
  useEffect(() => {
    initParticlesEngine(async (engine) => {
      // loadFull carrega todos os plugins, incluindo o Parallax
      await loadFull(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);

  const options: ISourceOptions = useMemo(
    () => ({
      background: {
        color: {
          value: "transparent", // Mantém o fundo da seção
        },
      },
      fpsLimit: 60,
      fullScreen: {
        enable: false, // CRÍTICO: impede o canvas de cobrir a página inteira
        zIndex: 0,
      },
      interactivity: {
        detectsOn: "window",
        events: {
          onHover: {
            enable: false,
          },
          onClick: {
            enable: false,
          },
        },
        modes: {
          repulse: {
            distance: 120,
            duration: 0.8,
          },
        },
      },
      particles: {
        color: {
          value: isLight ? ["#ff4d00", "#9333ea", "#2563eb", "#e11d48"] : ["#ff6b35", "#ac58ea", "#B2B1B3"],
        },
        links: {
          enable: false, // O tema NASA não usa conexões (linhas)
        },
        move: {
          direction: "none",
          enable: true,
          outModes: {
            default: "out",
          },
          random: true,
          speed: isLight ? 1.0 : 1.2,
          straight: false,
        },
        number: {
          density: {
            enable: true,
            area: 800,
          },
          value: isLight ? 50 : 60,
        },
        opacity: {
          value: isLight ? { min: 0.3, max: 0.8 } : { min: 0.1, max: 1 },
          animation: {
            enable: true,
            speed: 1,
            sync: false,
          },
        },
        shape: {
          type: "circle",
        },
        size: {
          value: isLight ? { min: 3, max: 6 } : { min: 2, max: 5 },
        },
      },
      detectRetina: true,
    }),
    [isLight],
  );

  if (init) {
    return (
      <Particles
        id="tsparticles-nasa"
        className="absolute inset-0 z-0 h-full w-full pointer-events-none transition-opacity duration-1000"
        options={options}
      />
    );
  }

  return <div className="absolute inset-0 z-0 bg-dark-bg transition-colors duration-500" />;
}
