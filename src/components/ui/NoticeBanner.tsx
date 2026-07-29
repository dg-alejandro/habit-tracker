import type { ReactNode } from 'react'

interface NoticeBannerProps {
  title: string
  detail?: ReactNode
  /**
   * `neutral` para avisar de algo; `alert` para cuando algo va mal.
   *
   * NO existe un tono rojo, y es a propósito: `streak-red` está reservado a la
   * ruptura de rachas y a los borrados de verdad (§6). Si el rojo viviera aquí,
   * alguien lo usaría para un error de red y la regla se rompería por la puerta
   * de atrás. El aviso grave de racha rota tiene su propio componente,
   * `stats/BrokenStreakNotice`.
   */
  tone?: 'neutral' | 'alert'
  /**
   * Segunda línea con el mensaje técnico. El único usuario de esta app es su
   * propio desarrollador y le sirve para diagnosticar; mismo criterio que ya
   * seguía el detalle de error de AuthSection.
   */
  technical?: string
  actions?: ReactNode
  role?: 'status' | 'alert'
  /** El margen lo pone quien la usa: en unos sitios es mt-4 y en otros mt-6. */
  className?: string
}

/**
 * La banda de aviso sobria de la app: fondo de tarjeta, filete, sin sombra y sin
 * modal. Estaba copiada a mano en FrozenDayBanner, ExportReminderBanner y la
 * confirmación de importar; ahora sale de un sitio, lo que de paso pone los tres
 * títulos en `font-display` como ya estaba el de BrokenStreakNotice.
 */
export function NoticeBanner({
  title,
  detail,
  tone = 'neutral',
  technical,
  actions,
  role,
  className = '',
}: NoticeBannerProps) {
  return (
    <div
      role={role}
      className={`rounded-sm border bg-surface px-4 py-3 ${
        tone === 'alert' ? 'border-ink' : 'border-line'
      } ${className}`}
    >
      <p className="font-display text-sm uppercase tracking-widest text-ink">{title}</p>
      {detail !== undefined && <p className="mt-1 text-sm text-ink-soft">{detail}</p>}
      {technical !== undefined && (
        <p className="mt-1 break-words font-display text-xs text-ink-faint">{technical}</p>
      )}
      {actions !== undefined && (
        <div className="mt-1 flex flex-wrap items-center gap-x-5">{actions}</div>
      )}
    </div>
  )
}
