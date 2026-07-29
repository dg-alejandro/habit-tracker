import { useSyncExternalStore } from 'react'

/*
 * Toda la interfaz escribe con `void repositorio.loQueSea(...)`: unas veinte
 * llamadas, ninguna con `.catch`. Si una falla —cuota de IndexedDB, base
 * bloqueada por otra pestaña, una restricción violada— el usuario marca su
 * hábito, ve la casilla cambiar por el optimismo de React y no se entera de
 * NADA. En una app cuyo único trabajo es no perder lo que marcas, eso no vale.
 *
 * Se resuelve con un oyente global de promesas rechazadas y no con un helper en
 * los veinte sitios: cero ediciones sobre fases ya cerradas, y cubre además lo
 * que se escriba mañana. Envolver los repositorios se descartó por peligroso —
 * se tragaría también los fallos que `data/sync.ts` NECESITA ver para reintentar.
 *
 * Contrapartida asumida: el mensaje es genérico y no dice QUÉ no se guardó.
 */

let current: Error | null = null
const listeners = new Set<() => void>()
let installed = false

function emit(): void {
  for (const listener of listeners) listener()
}

/** Se llama una vez desde App. Idempotente: StrictMode monta dos veces. */
export function installWriteErrorReporter(): void {
  if (installed) return
  installed = true

  window.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason
    if (!(reason instanceof Error)) return
    // Abortar una consulta no es un fallo: Dexie las cancela al desmontar.
    if (reason.name === 'AbortError') return

    current = reason
    emit()
    // Sin preventDefault(): el error tiene que seguir apareciendo en la consola.
    // El único usuario de esta app es quien la programa.
  })
}

export function dismissWriteError(): void {
  if (current === null) return
  current = null
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): Error | null {
  return current
}

/** El último fallo de escritura sin descartar, o null. */
export function useWriteError(): Error | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null)
}
