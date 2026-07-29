interface SkeletonRowsProps {
  rows?: number
  className?: string
}

/**
 * Marca de sitio mientras Dexie responde. Su trabajo es que no salte el layout,
 * no entretener: sobre IndexedDB local esto resuelve en decenas de milisegundos.
 *
 * Sin `animate-pulse` a propósito — la app desactiva toda animación bajo
 * `prefers-reduced-motion: reduce`, así que sería código que casi nadie ve.
 *
 * `aria-hidden`: para un lector de pantalla esto no es contenido. Quien necesite
 * anunciar la espera pone su propio `role="status"`.
 */
export function SkeletonRows({ rows = 6, className = '' }: SkeletonRowsProps) {
  return (
    <div aria-hidden="true" className={`divide-y divide-line ${className}`}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-14 bg-surface" />
      ))}
    </div>
  )
}
