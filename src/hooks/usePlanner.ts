import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ensureWeekReady, listWeekTasks } from '../data/repositories/plannerTasksRepo'
import { isSupabaseConfigured } from '../data/supabase'
import { syncStore } from '../data/sync'
import type { WeekId } from '../logic/dates'
import type { PlannerTask } from '../data/types'
import { useSession } from './useSession'

/** Tareas de una semana; undefined mientras carga. */
export function useWeekTasks(weekId: WeekId): PlannerTask[] | undefined {
  return useLiveQuery(() => listWeekTasks(weekId), [weekId])
}

/**
 * true cuando la foto local ya es de fiar para ESCRIBIR sola: sin Supabase o
 * sin sesión, de inmediato; con sesión, solo tras cerrar una bajada completa.
 *
 * Sin plazo de espera a propósito. La preparación de la semana genera y mueve
 * filas sin que el usuario toque nada, y la resolución de conflictos es por
 * última escritura: si se adelantara a la bajada, un dispositivo desactualizado
 * regeneraría una tarea fija que el otro había editado o borrado, y ganaría.
 * Sin conexión el planificador sigue siendo usable a mano; lo automático espera.
 */
export function useSyncSettled(): boolean {
  const snapshot = useSyncExternalStore(syncStore.subscribe, syncStore.getSnapshot)
  const session = useSession()

  if (!isSupabaseConfigured()) return true
  if (session === null) return true
  return snapshot.lastSyncedAt !== null
}

/**
 * Genera las tareas fijas de la semana visitada y arrastra las pendientes a la
 * semana actual, una sola vez por par de semanas.
 */
export function useWeekPreparation(weekId: WeekId, currentWeekId: WeekId): void {
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
