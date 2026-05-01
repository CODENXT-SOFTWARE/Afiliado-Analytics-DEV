'use client'

import type { CampaignPerformanceData } from "@/types";
import { useEffect, useState, useRef } from "react";
import { useTheme } from "@/app/components/theme/ThemeProvider";

const formatNumber = (value: number) => (value != null && value > 0) ? value.toLocaleString('pt-BR') : '0';

interface CampaignPerformanceProps {
  data: CampaignPerformanceData[];
  headers: string[];
}

export default function CampaignPerformanceTable({ data, headers }: CampaignPerformanceProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [firstHeader, ...restHeaders] = headers;
  const platformHeaders = restHeaders.slice(0, -1); // Todas exceto "Total"
  const totalHeader = restHeaders[restHeaders.length - 1]; // "Total"

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showRightShadow, setShowRightShadow] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const stickyShadow = isLight
    ? "2px 0 6px rgba(24, 24, 27, 0.08)"
    : "2px 0 6px rgba(24, 24, 27, 0.4)";

  const rightFadeGradient = isLight
    ? "linear-gradient(to left, rgba(244, 244, 245, 0.95) 0%, rgba(244, 244, 245, 0.6) 40%, rgba(244, 244, 245, 0.2) 70%, transparent 100%)"
    : "linear-gradient(to left, rgba(24, 24, 27, 0.95) 0%, rgba(24, 24, 27, 0.6) 40%, rgba(24, 24, 27, 0.2) 70%, transparent 100%)";

  useEffect(() => {
    // Detectar se é mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // 768px = breakpoint md do Tailwind
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const hasHorizontalScroll = container.scrollWidth > container.clientWidth;
      const scrollLeft = container.scrollLeft;
      const maxScrollLeft = container.scrollWidth - container.clientWidth;
      const isNearEnd = scrollLeft >= maxScrollLeft - 10; // 10px de margem

      // Mostrar sombra apenas se tem scroll E não está próximo do final
      setShowRightShadow(hasHorizontalScroll && !isNearEnd);
    };

    handleScroll();
    container.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [data]);

  return (
    <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
      <h3 className="text-lg font-semibold text-text-primary font-heading mb-4">
        Performance de Campanhas por Plataforma
      </h3>
      
      {/* Wrapper para estrutura sticky + scroll */}
      <div className="relative">
        {/* Container scrollável apenas para as colunas de dados */}
        <div 
          ref={scrollContainerRef}
          className="overflow-x-auto rounded-lg scrollbar-custom"
        >
          <table className="min-w-full table-auto border-collapse table-bordered">
            <thead className="bg-dark-bg border-b-2 border-shopee-orange/30">
              <tr>
                <th
                  className={`p-3 text-xs font-medium text-text-secondary uppercase tracking-wider rounded-tl-lg text-left ${
                    !isMobile ? 'sticky left-0 sticky-column-header' : 'mobile-column-header'
                  }`}
                  style={!isMobile && showRightShadow ? {
                    boxShadow: stickyShadow
                  } : undefined}
                >
                  {firstHeader}
                </th>
                
                {platformHeaders.map((header) => (
                  <th 
                    key={header} 
                    className="p-3 text-xs font-medium text-text-secondary uppercase tracking-wider text-center whitespace-nowrap"
                  >
                    {header}
                  </th>
                ))}
                
                <th className="total-column-header p-3 text-xs font-medium text-text-secondary uppercase tracking-wider rounded-tr-lg text-center whitespace-nowrap">
                  {totalHeader}
                </th>
              </tr>
            </thead>

            <tbody>
              {data.map((row) => (
                <tr key={row.subId} className="group hover:bg-dark-bg/50 transition-colors table-row-border">
                  <td
                    className={`p-3 text-sm text-text-primary font-semibold whitespace-nowrap text-left ${
                      !isMobile ? 'sticky left-0 sticky-column-body' : 'mobile-column-body'
                    }`}
                    style={!isMobile && showRightShadow ? {
                      boxShadow: stickyShadow
                    } : undefined}
                  >
                    {row.subId}
                  </td>

                  {platformHeaders.map(header => (
                    <td 
                      key={`${row.subId}-${header}`} 
                      className="p-3 text-sm text-text-primary font-mono text-center whitespace-nowrap"
                    >
                      {formatNumber(row[header as keyof typeof row] as number)}
                    </td>
                  ))}
                  
                  <td className="total-column-body p-3 text-sm text-text-primary font-bold font-mono text-center whitespace-nowrap">
                    {formatNumber(row.Total as number)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sombra gradiente escura sutil indicando mais conteúdo à direita */}
        {showRightShadow && (
          <div
            className="absolute top-0 right-0 bottom-0 w-12 pointer-events-none z-30"
            style={{
              background: rightFadeGradient,
            }}
          />
        )}
      </div>

      <style jsx>{`
        /* ============================================= */
        /* Estilização customizada do scrollbar (tema-aware) */
        /* ============================================= */
        .scrollbar-custom {
          scrollbar-width: thin;
          scrollbar-color: #f97316 ${isLight ? '#faf9f7' : '#18181B'};
        }

        /* Webkit browsers (Chrome, Safari, Edge) */
        .scrollbar-custom::-webkit-scrollbar {
          height: 10px;
        }

        .scrollbar-custom::-webkit-scrollbar-track {
          background: ${isLight ? '#faf9f7' : '#0F0F11'};
          border-radius: 5px;
          margin-left: ${!isMobile ? '200px' : '0px'}; /* Começa após a coluna sticky */
        }

        .scrollbar-custom::-webkit-scrollbar-thumb {
          background: #f97316;
          border-radius: 5px;
          border: 2px solid ${isLight ? '#FAFAFA' : '#18181B'};
        }

        .scrollbar-custom::-webkit-scrollbar-thumb:hover {
          background: #ea580c;
        }

        /* ============================================= */
        /* Background diferenciado para coluna Sub_ID */
        /* ============================================= */
        .sticky-column-header {
          background: ${isLight ? '#faf9f7' : '#141416'};
          z-index: 20;
        }

        .sticky-column-body {
          background: ${isLight ? '#FAFAFA' : '#141416'};
          z-index: 10;
        }

        /* Background para mobile (sem sticky) */
        .mobile-column-header {
          background: ${isLight ? '#faf9f7' : '#141416'};
        }

        .mobile-column-body {
          background: ${isLight ? '#FAFAFA' : '#141416'};
        }

        /* ============================================= */
        /* Background diferenciado para coluna TOTAL */
        /* ============================================= */
        .total-column-header {
          background: ${isLight ? '#faf9f7' : '#18181B'};
        }

        .total-column-body {
          background: ${isLight ? '#FAFAFA' : '#1B1B1D'};
        }

        /* ============================================= */
        /* Borders horizontais e verticais sutis */
        /* ============================================= */
        .table-row-border {
          border-bottom: 1px solid ${isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)'};
        }

        .table-bordered th,
        .table-bordered td {
          border-right: 1px solid ${isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)'};
        }

        /* Remove border direita da última coluna */
        .table-bordered th:last-child,
        .table-bordered td:last-child {
          border-right: none;
        }

        /* ============================================= */
        /* Hover effect - Sub_ID e Total com a mesma cor de hover */
        /* ============================================= */
        ${!isMobile ? `
          tbody tr.group:hover .sticky-column-body {
            background: ${isLight ? '#E4E4E7' : '#1c1c1f'};
          }

          tbody tr.group:hover .total-column-body {
            background: ${isLight ? '#E4E4E7' : '#1c1c1f'};
          }
        ` : ''}

        /* ============================================= */
        /* Garantir que células tenham transição suave */
        /* ============================================= */
        table {
          border-spacing: 0;
        }

        tbody td {
          transition: background-color 0.15s ease-in-out;
        }

        /* Transição suave para sombra da coluna sticky */
        ${!isMobile ? `
          table thead th:first-child,
          table tbody td:first-child {
            transition: box-shadow 0.15s ease-in-out, background-color 0.15s ease-in-out;
          }
        ` : ''}
      `}</style>
    </div>
  );
}
