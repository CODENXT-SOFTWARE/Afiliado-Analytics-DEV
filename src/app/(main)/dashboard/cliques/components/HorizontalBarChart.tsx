'use client';

import dynamic from 'next/dynamic';
import type { ChartOptions, TooltipItem } from 'chart.js';
import type { Context } from 'chartjs-plugin-datalabels';
import type { ClicksBarData } from '@/types';
import { useChartColors } from '@/app/components/theme/useChartColors';

// Carregar apenas no cliente para evitar SSR de canvas/libs que usam window.
const Bar = dynamic(() => import('react-chartjs-2').then(m => m.Bar), {
  ssr: false,
});

interface ChartProps {
  data?: ClicksBarData[];
  title: string;
  label: string;
}

const formatNumber = (value: number) => value.toLocaleString('pt-BR');

export default function HorizontalBarChart({ data = [], title, label }: ChartProps) {
  const colors = useChartColors();
  const maxDataValue = data.length > 0 ? Math.max(...data.map(d => d.clicks)) : 0;
  const threshold = maxDataValue > 0 ? maxDataValue * 0.7 : 0;

  // Datalabels desenhadas dentro da barra (laranja) ficam em branco; fora da barra,
  // adaptam à cor de texto do tema para não sumir no claro.
  const datalabelColor = (ctx: Context) => {
    const v = ctx.dataset.data[ctx.dataIndex] as number;
    return v > threshold ? '#FFFFFF' : colors.text;
  };

  const options: ChartOptions<'bar'> = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: title,
        color: colors.text,
        font: {
          size: 18,
          weight: 600,
          family: 'Poppins, sans-serif',
        },
        padding: {
          bottom: 20,
        },
      },
      tooltip: {
        enabled: false,
        callbacks: {
          label: function (context: TooltipItem<'bar'>) {
            const value = typeof context.raw === 'number' ? context.raw : 0;
            return `${label}: ${formatNumber(value)}`;
          },
        },
      },
      datalabels: {
        anchor: 'end',
        formatter: (value: number) => formatNumber(value),
        font: {
          weight: 600,
          size: 14,
        },
        color: datalabelColor,
        align: (ctx: Context) => {
          const v = ctx.dataset.data[ctx.dataIndex] as number;
          return v > threshold ? 'start' : 'end';
        },
        offset: 8,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          display: false,
        },
        border: {
          display: false,
        },
      },
      y: {
        grid: {
          display: false,
        },
        ticks: {
          color: colors.textSecondary,
          font: {
            size: 14,
          },
        },
        border: {
          display: false,
        },
      },
    },
  };

  const chartData = {
    labels: data.map(d => d.name),
    datasets: [
      {
        label: label,
        data: data.map(d => d.clicks),
        backgroundColor: '#EE4D2Dcc',
        hoverBackgroundColor: '#EE4D2D',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#EE4D2D',
      },
    ],
  };

  return (
    <div className="bg-dark-card p-6 rounded-lg border border-dark-border h-full">
      <div style={{ height: '300px' }}>
        <Bar key={`hbar-${data.length}-${title}`} options={options} data={chartData} />
      </div>
    </div>
  );
}
