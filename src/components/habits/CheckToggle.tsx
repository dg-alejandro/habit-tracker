interface CheckToggleProps {
  checked: boolean
}

/**
 * Casilla visual, sin interactividad propia: en los hábitos de casilla la pulsa
 * la fila entera; en los contadores es un indicador pasivo del cumplido automático.
 * La micro-animación (hundirse al pulsar, tick que se dibuja) vive en index.css.
 */
export function CheckToggle({ checked }: CheckToggleProps) {
  return (
    <span
      aria-hidden="true"
      className={`check-box flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 ${
        checked ? 'border-ink bg-ink' : 'border-line bg-paper'
      }`}
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4 text-paper" fill="none">
        <path
          d="M3 8.5 6.5 12 13 4.5"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`check-tick ${checked ? 'is-checked' : ''}`}
        />
      </svg>
    </span>
  )
}
