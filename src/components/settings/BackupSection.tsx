import { useState, type ChangeEvent } from 'react'
import { exportBackup, importBackup } from '../../data/backup'
import { useSettings } from '../../hooks/useSettings'
import { validateBackup, type BackupFile } from '../../logic/backup'
import { formatDateEs, logicalDateOf } from '../../logic/dates'

interface PendingImport {
  fileName: string
  file: BackupFile
}

/**
 * Exportar e importar TODO en JSON. Es el único respaldo que existe
 * (CLAUDE.md §9): el plan gratuito de Supabase no hace copias de seguridad.
 * La restauración confirma en dos pasos, en línea — sin modales.
 */
export function BackupSection() {
  const settings = useSettings()
  const [pending, setPending] = useState<PendingImport | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleExport(): Promise<void> {
    setBusy(true)
    setMessage(null)
    setPending(null)
    try {
      const file = await exportBackup()
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `habitos-backup-${logicalDateOf(new Date())}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      setMessage('Copia exportada. Guárdala en iCloud o similar.')
    } finally {
      setBusy(false)
    }
  }

  async function handlePick(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const picked = event.target.files?.[0]
    event.target.value = '' // permite volver a elegir el mismo archivo
    if (picked === undefined) return
    setMessage(null)
    setPending(null)
    let raw: unknown
    try {
      raw = JSON.parse(await picked.text())
    } catch {
      setMessage('El archivo no es JSON válido.')
      return
    }
    const validated = validateBackup(raw)
    if (!validated.ok) {
      setMessage(validated.reason)
      return
    }
    setPending({ fileName: picked.name, file: validated.file })
  }

  async function confirmImport(): Promise<void> {
    if (pending === null) return
    setBusy(true)
    try {
      await importBackup(pending.file)
      setPending(null)
      setMessage('Copia restaurada. Sincronizando…')
    } finally {
      setBusy(false)
    }
  }

  const lastExportAt = settings?.lastExportAt ?? null

  return (
    <section className="mt-12">
      <h2 className="text-xs font-medium uppercase tracking-widest text-ink-soft">
        Copia de seguridad
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        La exportación JSON es el único respaldo: Supabase no hace copias en el plan gratuito.
        {lastExportAt !== null &&
          ` Última exportación: ${formatDateEs(logicalDateOf(new Date(lastExportAt)))}.`}
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void handleExport()
          }}
          className="h-11 rounded-lg bg-ink px-5 text-sm font-semibold text-paper disabled:opacity-30"
        >
          Exportar copia
        </button>
        <label className="flex h-11 cursor-pointer items-center rounded-lg px-4 text-sm text-ink-soft transition-colors hover:bg-surface hover:text-ink">
          Importar copia…
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            disabled={busy}
            onChange={(event) => {
              void handlePick(event)
            }}
          />
        </label>
      </div>

      {pending !== null && (
        <div className="mt-4 rounded-lg border border-line bg-surface px-4 py-3">
          <p className="text-sm font-semibold text-ink">
            Esto reemplaza TODOS los datos de este dispositivo.
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            «{pending.fileName}»: {pending.file.data.habits.length} hábitos,{' '}
            {pending.file.data.entries.length} registros. La copia restaurada también se impondrá
            al sincronizar.
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void confirmImport()
              }}
              className="h-11 rounded-lg bg-ink px-5 text-sm font-semibold text-paper disabled:opacity-30"
            >
              Restaurar la copia
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setPending(null)}
              className="h-11 rounded-lg px-4 text-sm text-ink-soft transition-colors hover:bg-surface hover:text-ink"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {message !== null && <p className="mt-3 text-sm font-semibold text-ink">{message}</p>}
    </section>
  )
}
