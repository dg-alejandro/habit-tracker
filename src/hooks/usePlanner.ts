import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ensureWeekReady, listWeekTasks } from '../data/repositories/plannerTasksRepo'
import { listTaskTemplates } from '../data/repositories/taskTemplatesRepo'
import { isSupabaseConfigured } from '../data/supabase'
import { syncStore } from '../data/sync'
import type { WeekId } from '../logic/dates'
import type { PlannerTask, TaskTemplate } from '../data/types'
import { useSession } from './useSession'

/** Tareas de una semana; undefined mientras carga. */
export function useWeekTasks(weekId: WeekId): PlannerTask[] | undefined {
  return useLiveQuery(() => listWeekTasks(weekId), [weekId])
}

/** Catálogo de plantillas por día y hora; undefined mientras carga. */
export function useTaskTemplates(): TaskTemplate[] | undefined {
  return useLiveQuery(listTaskTemplates, [])
}

/**
 * true cuando ya no cabe esperar una bajada que cambie lo que vemos: sin
 * Supabase o sin sesión, de inmediato; con sesión, al cerrar el primer ciclo de
 * esta ejecución o, como mucho, pasado el plazo. Sin conexión la bajada no
 * llegará nunca y el planificador tiene que funcionar igual (CLAUDE.md §2).
 */
export function useSyncSettled(timeoutMs = 4000): boolean {
  const snapshot = useSyncExternalStore(syncStore.subscribe, syncStore.getSnapshot)
  const session = useSession()
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setExpired(true), timeoutMs)
    return () => window.clearTimeout(timer)
  }, [timeoutMs])

  if (!isSupabaseConfigured()) return true
  if (session === null) return true
  return snapshot.lastSyncedAt !== null || expired
}

/**
 * Genera las tareas fijas de la semana visitada y arrastra las pendientes a la
 * semana actual, una sola vez por par de semanas. Espera a que la bajada se
 * asiente para no materializar sobre una foto anterior al pull; si aun así se
 * adelantara, el id determinista de las generadas impide el duplicado.
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
    void ensureWeekReady(weekId, currentWeekId)
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
