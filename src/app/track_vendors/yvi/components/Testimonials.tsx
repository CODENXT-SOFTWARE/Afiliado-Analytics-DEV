'use client'

import React, { useCallback, useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import Image from 'next/image'

interface Testimonial {
  id: number
  quote: string
  name: string
  role: string
  avatar: string
}

const testimonialsData: Testimonial[] = [
  {
    id: 1,
    quote: 'Automatizar ofertas no WhatsApp e saber meu lucro exato por lead mudou o jogo. A Calculadora GPL é surreal!',
    name: 'Ana Silva',
    role: 'Afiliada Profissional',
    avatar: '/dep/ana.png',
  },
  {
    id: 2,
    quote: 'O termômetro da ATIA me fez parar de queimar dinheiro. Ele cruza Meta e Shopee e diz na hora qual criativo escalar.',
    name: 'Carlos Oliveira',
    role: 'Especialista em E-commerce',
    avatar: '/dep/carlos.png',
  },
  {
    id: 3,
    quote: 'Fim do trabalho manual. Agora eu gerencio minhas listas e disparo ofertas para os meus grupos de WhatsApp no piloto automático.',
    name: 'Juliana Pereira',
    role: 'Influenciadora Digital',
    avatar: '/dep/juliana.png',
  },
  {
    id: 4,
    quote: 'Escalar campanhas ficou muito mais seguro. A ATIA valida meus anúncios e a Calculadora GPL me dá o teto exato por clique.',
    name: 'Ricardo Mendes',
    role: 'Gestor de Tráfego',
    avatar: '/dep/ricardo.png',
  },
  {
    id: 5,
    quote: 'Ficar travada sem programador, nunca mais. Agora crio minhas próprias páginas de captura de alta conversão em minutos.',
    name: 'Beatriz Costa',
    role: 'Iniciante em Afiliados',
    avatar: '/dep/beatriz.png',
  },
]

export default function Testimonials() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 3000, stopOnInteraction: false, stopOnMouseEnter: true }),
  ])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([])

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev()
  }, [emblaApi])

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext()
  }, [emblaApi])

  const scrollTo = useCallback(
    (index: number) => {
      if (emblaApi) emblaApi.scrollTo(index)
    },
    [emblaApi]
  )

  const onInit = useCallback(() => {
    if (!emblaApi) return
    setScrollSnaps(emblaApi.scrollSnapList())
  }, [emblaApi])

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return

    onInit()
    onSelect()
    emblaApi.on('reInit', onInit)
    emblaApi.on('reInit', onSelect)
    emblaApi.on('select', onSelect)
  }, [emblaApi, onInit, onSelect])

  return (
    <section id="testimonials" className="relative py-20 sm:py-32 bg-dark-bg light:bg-[#faf9f7] transition-colors duration-500">
      {/* ── BLEED TOP GLOW (Matching Mockup/Theme) ── */}
      <div
        className="pointer-events-none absolute top-0 left-[2%] h-[600px] w-[600px] z-0"
        style={{
          background: 'radial-gradient(circle, rgba(255,107,53,0.10), transparent 70%)',
          filter: 'blur(70px)',
        }}
        aria-hidden="true"
      />

      <style>{`
        #testimonials {
          --bg-color: transparent;
          --text-primary: #ffffff;
          --text-secondary: rgba(255, 255, 255, 0.5);
          --card-bg: rgba(255, 255, 255, 0.03);
          --card-border: rgba(255, 255, 255, 0.06);
          --accent: #ff6b35;
          --slide-gap: clamp(0.75rem, 2vw, 1.25rem);
          
          color: var(--text-primary);
          display: flex;
          align-items: center;
          overflow-x: hidden;
        }

        #testimonials * {
          box-sizing: border-box;
        }

        #testimonials .t-container {
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 1.5rem; /* px-6 */
          display: flex;
          align-items: stretch;
          justify-content: space-between;
          gap: 4rem;
          position: relative;
          z-index: 10;
        }

        #testimonials .intro-section {
          flex: 1;
          max-width: 600px;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        #testimonials .controls {
          display: flex;
          gap: 1rem;
          margin-top: auto;
          padding-bottom: 2rem;
        }

        #testimonials .btn-nav {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: rgba(255, 255, 255, 0.05);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          padding: 0;
          backdrop-filter: blur(8px);
        }

        #testimonials .btn-nav:hover {
          background: var(--accent);
          border-color: var(--accent);
          color: white;
          transform: scale(1.05);
          box-shadow: 0 0 20px rgba(255, 107, 53, 0.4);
        }

        #testimonials .btn-nav:active {
          transform: scale(0.95);
        }

        #testimonials .carousel-stage {
          flex: 1;
          max-width: 650px;
          position: relative;
        }

        #testimonials .embla__viewport {
          width: 100%;
          overflow: hidden;
          border-radius: 24px;
          position: relative;
        }

        #testimonials .embla__container {
          display: flex;
          width: 100%;
          margin-left: calc(var(--slide-gap) * -1);
        }

        #testimonials .embla__slide {
          flex: 0 0 100%;
          min-width: 0;
          padding-left: var(--slide-gap);
          box-sizing: border-box;
        }

        #testimonials .card {
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          padding: 4rem;
          display: flex;
          flex-direction: column;
          gap: 2.5rem;
          backdrop-filter: blur(10px);
          min-height: 440px;
          transition: border-color 0.3s ease;
          border-radius: 24px;
        }

        #testimonials .card:hover {
          border-color: rgba(255, 107, 53, 0.3);
        }

        #testimonials .quote-mark {
          font-size: 5rem;
          color: var(--accent);
          opacity: 0.3;
          line-height: 0;
          margin-top: 2.5rem;
          font-family: serif;
        }

        #testimonials .review-text {
          font-size: 1.45rem;
          line-height: 1.7;
          color: #e4e4e7;
          font-weight: 300;
          flex-grow: 1;
          margin: 0;
        }

        #testimonials .client-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        #testimonials .client-avatar {
          width: 65px;
          height: 65px;
          border-radius: 50%;
          object-fit: cover;
          background: #27272a;
          border: 2px solid rgba(255, 255, 255, 0.1);
        }

        #testimonials .client-details h4 {
          font-family: 'Inter', sans-serif;
          font-size: 1.25rem;
          margin: 0;
          margin-bottom: 0.2rem;
        }

        #testimonials .client-details p {
          color: var(--accent);
          font-size: 1rem;
          font-weight: 500;
          margin: 0;
        }

        #testimonials .indicators {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-top: 1.5rem;
        }

        #testimonials .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--card-border);
          cursor: pointer;
          transition: all 0.3s ease;
        }

        #testimonials .dot.active {
          background: var(--accent);
          width: 24px;
          border-radius: 10px;
        }

        @media (max-width: 968px) {
          #testimonials .t-container {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }

          #testimonials .intro-section {
            align-items: center;
          }

          #testimonials .controls {
            display: none;
          }

          #testimonials .carousel-stage {
            width: 100%;
          }

          #testimonials .card {
            padding: 2rem;
            min-height: auto;
          }
        }

        .light #testimonials {
          --text-primary: #18181b;
          --text-secondary: rgba(63, 63, 70, 0.75);
          --card-bg: #ffffff;
          --card-border: rgba(234, 88, 12, 0.28);
          --accent: #ea580c;
          color: var(--text-primary);
        }
        .light #testimonials .review-text {
          color: #3f3f46;
        }
        .light #testimonials .client-details h4 {
          color: #18181b;
        }
        .light #testimonials .btn-nav {
          border-color: rgba(24, 24, 27, 0.14);
          background: rgba(255, 255, 255, 0.98);
          color: #27272a;
        }
        .light #testimonials .btn-nav:hover {
          color: #ffffff;
        }
        .light #testimonials .client-avatar {
          background: #f4f4f5;
          border-color: rgba(234, 88, 12, 0.28);
        }
        .light #testimonials .dot:not(.active) {
          background: rgba(39, 39, 42, 0.18);
        }
      `}</style>

      <div className="t-container">
        <div className="intro-section">
          <h2 className="font-[var(--font-space-grotesk)] text-[clamp(2.5rem,5vw,3.5rem)] font-black leading-[1.1] tracking-[-0.04em] text-white light:text-zinc-900 m-0">
            Resultados que <br />
            <span className="bg-gradient-to-br from-[#ff6b35] to-[#ff8c5a] bg-clip-text text-transparent">falam por si.</span>
          </h2>
          <p className="font-['Inter'] text-[18px] leading-[1.8] text-white/50 light:text-zinc-600 m-0">
            Nossa tecnologia já ajudou dezenas de empreendedores a escalarem suas operações com um ecossistema impecável e alta performance.
          </p>

          <div className="controls">
            <button className="btn-nav" aria-label="Anterior" onClick={scrollPrev}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button className="btn-nav" aria-label="Próximo" onClick={scrollNext}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>

        <div className="carousel-stage">
          <div className="embla__viewport" ref={emblaRef}>
            <div className="embla__container">
              {testimonialsData.map((item) => (
                <div className="embla__slide" key={item.id}>
                  <div className="card">
                    <div className="quote-mark">&quot;</div>
                    <p className="review-text">{item.quote}</p>
                    <div className="client-info">
                      <Image
                        src={item.avatar}
                        alt={item.name}
                        className="client-avatar"
                        width={65}
                        height={65}
                      />
                      <div className="client-details">
                        <h4>{item.name}</h4>
                        <p>{item.role}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="indicators">
            {scrollSnaps.map((_, index) => (
              <div
                key={index}
                className={`dot ${index === selectedIndex ? 'active' : ''}`}
                onClick={() => scrollTo(index)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}