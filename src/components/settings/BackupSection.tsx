import { useState, type ChangeEvent } from 'react'
import { exportBackup, importBackup } from '../../data/backup'
import { useSettings } from '../../hooks/useSettings'
import { validateBackup, type BackupFile } from '../../logic/backup'
import { formatDateEs, logicalDateOf } from '../../logic/dates'
import { NoticeBanner } from '../ui/NoticeBanner'
import { BUTTON_DANGER, BUTTON_PRIMARY, BUTTON_QUIET } from '../ui/classes'

interface PendingImport {
  fileName: string
  file: BackupFile
}

/**
 * Antes esto era un `message: string | null` y «Copia exportada» y «El archivo
 * no es JSON válido» se pintaban exactamente igual. Ahora el éxito es una línea
 * discreta y el fallo una banda de aviso con su detalle técnico.
 */
interface BackupResult {
  kind: 'ok' | 'error'
  text: string
  detail?: string
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Exportar e importar TODO en JSON. Es el único respaldo que existe
 * (CLAUDE.md §9): el plan gratuito de Supabase no hace copias de seguridad.
 * La restauración confirma en dos pasos, en línea — sin modales.
 */
export function BackupSection() {
  const settings = useSettings()
  const [pending, setPending] = useState<PendingImport | null>(null)
  const [result, setResult] = useState<BackupResult | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleExport(): Promise<void> {
    setBusy(true)
    setResult(null)
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
      setResult({ kind: 'ok', text: 'Copia exportada. Guárdala en iCloud o similar.' })
    } catch (error) {
      // Esto era un try/finally SIN catch: la exportación podía fallar y no se
      // veía absolutamente nada. Es el único respaldo que existe (§9).
      setResult({
        kind: 'error',
        text: 'No se ha podido exportar la copia.',
        detail: errorText(error),
      })
    } finally {
      setBusy(false)
    }
  }

  async function handlePick(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const picked = event.target.files?.[0]
    event.target.value = '' // permite volver a elegir el mismo archivo
    if (picked === undefined) return
    setResult(null)
    setPending(null)
    let raw: unknown
    try {
      raw = JSON.parse(await picked.text())
    } catch {
      setResult({ kind: 'error', text: 'El archivo no es JSON válido.' })
      return
    }
    const validated = validateBackup(raw)
    if (!validated.ok) {
      setResult({ kind: 'error', text: validated.reason })
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
      setResult({ kind: 'ok', text: 'Copia restaurada. Sincronizando…' })
    } catch (error) {
      // «Tus datos no se han tocado» es literalmente cierto, no un consuelo:
      // importBackup corre entero dentro de una transacción de Dexie, así que
      // un fallo revierte también el borrado previo.
      setResult({
        kind: 'error',
        text: 'No se ha podido restaurar la copia. Tus datos no se han tocado.',
        detail: errorText(error),
      })
    } finally {
      setBusy(false)
    }
  }

  const lastExportAt = settings?.lastExportAt ?? null

  return (
    <section className="mt-12">
      <h2 className="font-display text-xs uppercase tracking-widest text-streak-lime">
        Copia de seguridad
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        La exportación JSON es el único respaldo: Supabase no hace copias en el plan gratuito.
        {lastExportAt !== null && (
          <>
            {' '}
            Última exportación:{' '}
            <span className="font-display">
              {formatDateEs(logicalDateOf(new Date(lastExportAt)))}
            </span>
            .
          </>
        )}
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void handleExport()
          }}
          className={BUTTON_PRIMARY}
        >
          Exportar copia
        </button>
        <label className={`cursor-pointer ${BUTTON_QUIET}`}>
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
        <NoticeBanner
          className="mt-4"
          tone="alert"
          title="Esto reemplaza TODOS los datos de este dispositivo"
          detail={
            <>
              «{pending.fileName}»:{' '}
              <span className="font-display tabular-nums">{pending.file.data.habits.length}</span>{' '}
              hábitos,{' '}
              <span className="font-display tabular-nums">{pending.file.data.entries.length}</span>{' '}
              registros. La copia restaurada también se impondrá al sincronizar.
            </>
          }
          actions={
            <>
              {/* Rojo, porque borra de verdad (§6): iba en bg-ink, con el
                  mismo aspecto que el botón benigno de «Exportar copia». */}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void confirmImport()
                }}
                className={BUTTON_DANGER}
              >
                Restaurar la copia
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setPending(null)}
                className={BUTTON_QUIET}
              >
                Cancelar
              </button>
            </>
          }
        />
      )}

      {result !== null &&
        (result.kind === 'ok' ? (
          <p role="status" className="mt-3 text-sm text-ink-soft">
            {result.text}
          </p>
        ) : (
          <NoticeBanner
            className="mt-3"
            role="alert"
            tone="alert"
            title={result.text}
            {...(result.detail === undefined ? {} : { technical: result.detail })}
          />
        ))}
    </section>
  )
}
