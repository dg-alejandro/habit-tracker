import { UpdatePrompt } from './UpdatePrompt'
import { WriteErrorNotice } from './WriteErrorNotice'

/**
 * Los avisos que pueden aparecer en cualquier pantalla, apilados al pie.
 *
 * Fijo y no en el flujo: así no consume el hueco de la barra ni obliga a
 * coordinar alturas con nadie. Y sobre todo, en el registro diario un aviso en
 * flujo empujaría el porcentaje semanal —«el dato más importante de la app»,
 * §5.1— fuera de la primera pantalla.
 *
 * Va por encima de la barra de navegación (que es z-10) y respeta su altura más
 * el inset del gesto del iPhone.
 */
export function NoticeDock() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px)+0.75rem)] md:pb-4">
      <div className="pointer-events-auto mx-auto flex max-w-xl flex-col gap-2">
        <UpdatePrompt />
        <WriteErrorNotice />
      </div>
    </div>
  )
}
