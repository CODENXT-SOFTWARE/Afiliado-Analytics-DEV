'use client'

import { useMemo } from 'react'

/** SVG da bandeira brasileira — renderização consistente (Windows/Chrome
 * não renderiza flag emoji, cai em "BR" texto). */
function BRFlagSVG({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 14 10"
      className={className}
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="14" height="10" fill="#009C3B" />
      <polygon points="7,1 13,5 7,9 1,5" fill="#FFDF00" />
      <circle cx="7" cy="5" r="2" fill="#002776" />
    </svg>
  )
}

/** Formata dígitos BR: 11XXXXXXXXX → (11) XXXXX-XXXX.
 * Aceita até 11 dígitos (DDD 2 + número 8 ou 9). Descarta não-dígitos.
 */
export function formatBRPhone(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

type InputStyle = {
  background?: string
  borderColor?: string
  color?: string
  placeholderColor?: string
}

type Props = {
  value: string
  onChange: (formatted: string) => void
  placeholder?: string
  style?: InputStyle
  id?: string
  disabled?: boolean
}

/** Input WhatsApp padrão brasileiro: bandeira 🇧🇷 + "+55" (fixo) + número com máscara (XX) XXXXX-XXXX. */
export default function WhatsAppInputBR({
  value,
  onChange,
  placeholder = '(11) 99999-9999',
  style,
  id,
  disabled,
}: Props) {
  const formatted = useMemo(() => formatBRPhone(value), [value])

  return (
    <div
      className="flex items-stretch rounded-xl border overflow-hidden transition-colors focus-within:border-[#635bff]"
      style={{
        background: style?.background,
        borderColor: style?.borderColor,
      }}
    >
      <div
        className="flex items-center gap-1.5 px-3 shrink-0 border-r select-none"
        style={{ borderColor: style?.borderColor, color: style?.color }}
        aria-hidden
      >
        <BRFlagSVG className="h-4 w-[22px] shrink-0 rounded-sm" />
        <span className="text-[13px] font-medium">+55</span>
      </div>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={formatted}
        onChange={(e) => onChange(formatBRPhone(e.target.value))}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 min-w-0 px-3 py-2.5 text-[13px] bg-transparent outline-none disabled:opacity-50"
        style={{ color: style?.color }}
      />
    </div>
  )
}
