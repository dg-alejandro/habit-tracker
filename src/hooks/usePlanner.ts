import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ensureWeekReady, listWeekTasks } from '../data/repositories/plannerTasksRepo'
import { listBankTasks } from '../data/repositories/taskBankRepo'
import { isSupabaseConfigured } from '../data/supabase'
import { syncStore } from '../data/sync'
import type { IsoWeekday, WeekId } from '../logic/dates'
import { blockOfWallClock, type BankTask } from '../logic/planner'
import { madridWallClock } from '../logic/dates'
import type { NowMarker } from '../components/planner/HourGrid'
import type { PlannerTask } from '../data/types'
import { useSession } from './useSession'

/** Tareas de una semana; undefined mientras carga. */
export function useWeekTasks(weekId: WeekId): PlannerTask[] | undefined {
  return useLiveQuery(() => listWeekTasks(weekId), [weekId])
}

/** El banco de tareas reutilizables; undefined mientras carga. */
export function useBankTasks(): BankTask[] | undefined {
  return useLiveQuery(listBankTasks, [])
}

/**
 * Dónde cae la raya de «ahora» en la cuadrícula, o null si la semana visitada
 * no es la actual. Se recalcula cada minuto: la raya tiene que moverse sola.
 */
export function useNowMarker(todayWeekday: IsoWeekday | null): NowMarker | null {
  const [wall, setWall] = useState(() => madridWallClockNow())

  useEffect(() => {
    const timer = window.setInterval(() => setWall(madridWallClockNow()), 60_000)
    const refresh = (): void => setWall(madridWallClockNow())
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  if (todayWeekday === null) return null
  const block = blockOfWallClock(wall.hour, wall.minute)
  return { day: todayWeekday, block, fraction: (wall.minute % 30) / 30 }
}

/** La zona horaria vive en `logic/dates.ts` y en ningún otro sitio. */
function madridWallClockNow(): { hour: number; minute: number } {
  const wall = madridWallClock(new Date())
  return { hour: wall.hour, minute: wall.minute }
}

/**
 * true cuando la foto local ya es de fiar para ESCRIBIR sola: sin Supabase o
 * sin sesión, de inmediato; con sesión, solo tras cerrar una bajada completa.
 *
 * Sin plazo de espera a propósito. La preparación de la semana genera y mueve
 * filas sin que el usuario toque nada, y la resolución de conflictos es por
 * última escritura: si se adelantara a la bajada, un dispositivo desactualizado
 * borraría tareas que el otro acababa de completar, y ganaría.
 * Sin conexión el planificador sigue siendo usable a mano; lo automático espera.
 */
export function useSyncSettled(): boolean {
  const snapshot = useSyncExternalStore(syncStore.subscribe, syncStore.getSnapshot)
  const session = useSession()

  if (!isSupabaseConfigured()) return true
  if (session === null) return true
  // `lastPulledAt` y NO `lastSyncedAt`: este último lo estampa también un ciclo
  // de solo subida, que no ha traído nada del servidor. Bastaba con que la
  // bajada inicial fallara y el propietario escribiera algo en los segundos
  // siguientes para que la purga se creyera al día y borrara, con la foto vieja
  // en la mano, tareas que el iPhone acababa de completar.
  return snapshot.lastPulledAt !== null
}

/**
 * Limpia lo que caducó al cambiar de semana, una sola vez por par de semanas.
 *
 * Devuelve si la sincronización está asentada, para que la pantalla pueda decir
 * que está esperando en vez de quedarse parada en silencio.
 */
export function useWeekPreparation(weekId: WeekId, currentWeekId: WeekId): boolean {
  const settled = useSyncSettled()
  // Sobrevive al doble efecto de StrictMode sin depender de cómo se serialicen
  // las transacciones de Dexie.
  const done = useRef(new Set<string>())

  useEffect(() => {
    if (!settled) return
    const key = `${weekId}|${currentWeekId}`
    if (done.current.has(key)) return
    done.current.add(key)
    // Si falla, se desmarca: un error transitorio no puede dejar el
    // planificador sin generar ni arrastrar para el resto de la sesión.
    void ensureWeekReady(weekId, currentWeekId).catch(() => done.current.delete(key))
  }, [settled, weekId, currentWeekId])

  return settled
}

const DESKTOP_QUERY = '(min-width: 768px)'

/**
 * true a partir del breakpoint `md`. En móvil el planificador muestra un día
 * cada vez, y esa decisión NO puede tomarse con `hidden md:`: renderizar los
 * dos árboles duplicaría las zonas de soltado del drag & drop.
 */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribeToDesktop, getDesktopSnapshot, () => true)
}

function subscribeToDesktop(onChange: () => void): () => void {
  const query = window.matchMedia(DESKTOP_QUERY)
  query.addEventListener('change', onChange)
  // También al `resize`: girar el iPhone cruza el breakpoint y hay entornos
  // donde el evento del media query no llega. Comparar el snapshot es barato.
  window.addEventListener('resize', onChange)
  return () => {
    query.removeEventListener('change', onChange)
    window.removeEventListener('resize', onChange)
  }
}

function getDesktopSnapshot(): boolean {
  return window.matchMedia(DESKTOP_QUERY).matches
}
