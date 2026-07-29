interface GripIconProps {
  size?: 'sm' | 'md'
}

/**
 * Asa de arrastre. Estaba copiada en tres sitios —dos de ellas byte a byte, y la
 * del banco de tareas solo cambiaba el tamaño—, así que el tamaño es la prop.
 */
export function GripIcon({ size = 'md' }: GripIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'}
      fill="currentColor"
    >
      <circle cx="7" cy="5" r="1.5" />
      <circle cx="13" cy="5" r="1.5" />
      <circle cx="7" cy="10" r="1.5" />
      <circle cx="13" cy="10" r="1.5" />
      <circle cx="7" cy="15" r="1.5" />
      <circle cx="13" cy="15" r="1.5" />
    </svg>
  )
}
