import { dismissWriteError, useWriteError } from '../../hooks/useWriteErrors'
import { NoticeBanner } from './NoticeBanner'
import { NOTICE_ACTION } from './classes'

/**
 * Una escritura local ha fallado. No se auto-oculta con un temporizador: esto
 * es justo lo que quieres seguir viendo treinta segundos después.
 */
export function WriteErrorNotice() {
  const error = useWriteError()
  if (error === null) return null

  return (
    <NoticeBanner
      role="alert"
      tone="alert"
      title="No se ha podido guardar el cambio"
      detail="Vuelve a intentarlo. Si se repite, exporta la copia desde Ajustes."
      technical={error.message}
      actions={
        <button type="button" onClick={dismissWriteError} className={NOTICE_ACTION}>
          Cerrar
        </button>
      }
    />
  )
}
