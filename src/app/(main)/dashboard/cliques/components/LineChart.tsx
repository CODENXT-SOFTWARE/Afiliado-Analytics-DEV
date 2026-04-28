'use client';

import dynamic from 'next/dynamic';
import type { ChartOptions, TooltipItem } from 'chart.js';
import type { Context } from 'chartjs-plugin-datalabels';
import type { ClicksByHourData } from '@/types';
import { useChartColors } from '@/app/components/theme/useChartColors';

// Carregar apenas no cliente para evitar SSR de canvas/libs que usam window.
const Line = dynamic(() => import('react-chartjs-2').then(m => m.Line), {
  ssr: false,
});

interface ChartProps {
  data?: ClicksByHourData[];
  title: string;
  label: string;
}

const formatNumber = (value: number) => value.toLocaleString('pt-BR');

export default function LineChart({ data = [], title, label }: ChartProps) {
  const colors = useChartColors();
  const maxDataValue = data.length > 0 ? Math.max(...data.map(d => d.clicks)) : 0;
  const threshold = maxDataValue > 0 ? maxDataValue * 0.9 : 0;

  const options: ChartOptions<'line'> = {
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
        backgroundColor: colors.tooltipBg,
        titleColor: colors.tooltipTitle,
        bodyColor: colors.tooltipBody,
        borderColor: colors.tooltipBorder,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: function (context: TooltipItem<'line'>) {
            const value = typeof context.raw === 'number' ? context.raw : 0;
            return `${label}: ${formatNumber(value)}`;
          },
        },
      },
      datalabels: {
        display: 'auto',
        anchor: 'end',
        offset: 8,
        color: colors.text,
        font: {
          weight: 600,
        },
        formatter: (value: number) => {
          return value > 0 ? formatNumber(value) : null;
        },
        align: (ctx: Context) => {
          const v = ctx.dataset.data[ctx.dataIndex] as number;
          return v > threshold ? 'bottom' : 'top';
        },
      },
    },
    scales: {
      x: {
        grid: { color: colors.grid },
        ticks: { color: colors.textSecondary },
      },
      y: {
        grid: { color: colors.grid },
        ticks: { color: colors.textSecondary },
      },
    },
  };

  const chartData = {
    labels: data.map(d => d.hour),
    datasets: [
      {
        fill: true,
        label: label,
        data: data.map(d => d.clicks),
        borderColor: '#EE4D2D',
        backgroundColor: 'rgba(238, 77, 45, 0.2)',
        pointBackgroundColor: '#EE4D2D',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
        pointHoverBackgroundColor: '#FFFFFF',
        pointHoverBorderColor: '#EE4D2D',
        pointHoverBorderWidth: 2,
        pointRadius: 4,
        tension: 0.4,
      },
    ],
  };

  return (
    <div className="bg-dark-card p-6 rounded-lg border border-dark-border h-full">
      <div style={{ height: '300px' }}>
        <Line key={`line-${data.length}-${title}`} options={options} data={chartData} />
      </div>
    </div>
  );
}
