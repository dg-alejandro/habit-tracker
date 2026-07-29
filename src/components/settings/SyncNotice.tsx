import { Link } from 'react-router'
import { useSyncStatus } from '../../hooks/useSyncStatus'
import { NoticeBanner } from '../ui/NoticeBanner'
import { NOTICE_ACTION } from '../ui/classes'

/**
 * Aviso de sincronización en la pantalla que se abre cada noche.
 *
 * En el iPhone el estado solo existía como un carácter de 12 px en la esquina
 * de la pestaña Ajustes, y encima con `aria-hidden`: si la sincronización
 * llevaba días rota, no había forma de enterarse sin ir a buscarlo.
 *
 * Aparece SOLO cuando hay algo que hacer. Nunca con `pending`, que es el estado
 * normal durante unos segundos cada vez que se marca un hábito, ni con
 * `disabled`, que es una configuración y no un problema.
 */
export function SyncNotice() {
  const { status, pendingCount, lastError, retry } = useSyncStatus()

  const visible =
    status === 'error' || status === 'signedOut' || (status === 'offline' && pendingCount > 0)
  if (!visible) return null

  if (status === 'signedOut') {
    return (
      <NoticeBanner
        className="mt-6"
        title="Sin sesión"
        detail="Los cambios se guardan aquí, pero no llegan al otro dispositivo."
        actions={
          <Link to="/ajustes" className={NOTICE_ACTION}>
            Iniciar sesión
          </Link>
        }
      />
    )
  }

  if (status === 'offline') {
    return (
      <NoticeBanner
        className="mt-6"
        title="Sin conexión"
        detail={
          <>
            <span className="font-display tabular-nums">{pendingCount}</span>{' '}
            {pendingCount === 1 ? 'cambio' : 'cambios'} en cola. Se subirán solos al recuperarla.
          </>
        }
      />
    )
  }

  return (
    <NoticeBanner
      className="mt-6"
      role="alert"
      tone="alert"
      title="La sincronización falla"
      detail="Lo que marcas está guardado en este dispositivo. Se reintenta solo."
      {...(lastError === null ? {} : { technical: lastError })}
      actions={
        <button type="button" onClick={retry} className={NOTICE_ACTION}>
          Reintentar ahora
        </button>
      }
    />
  )
}
