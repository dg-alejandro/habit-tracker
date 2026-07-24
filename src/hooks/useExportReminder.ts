import { shouldRemindExport } from '../logic/backup'
import { useAllHabits } from './useHabits'
import { useLogicalToday } from './useLogicalToday'
import { useSettings } from './useSettings'

/** true si toca avisar de que hace >30 días de la última exportación. */
export function useExportReminder(): boolean {
  const today = useLogicalToday()
  const settings = useSettings()
  const habits = useAllHabits()

  if (habits === undefined) return false // cargando: sin parpadeo del aviso
  const oldestCreatedOn =
    habits.length === 0 ? null : habits.map((habit) => habit.createdOn).sort()[0] ?? null
  return shouldRemindExport(settings?.lastExportAt ?? null, oldestCreatedOn, today)
}
