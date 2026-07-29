import { useAppUpdate } from '../../hooks/useAppUpdate'
import { NoticeBanner } from './NoticeBanner'
import { NOTICE_ACTION } from './classes'

/** Aviso de versión nueva. Nada se recarga solo: lo decide el usuario. */
export function UpdatePrompt() {
  const { needRefresh, update, dismiss } = useAppUpdate()
  if (!needRefresh) return null

  return (
    <NoticeBanner
      role="status"
      title="Hay una versión nueva"
      /* La frase importa: en una app local-first el miedo es perder lo que
         acabas de teclear, y hay que desactivarlo explícitamente. */
      detail="Se aplicará al recargar. Lo que has marcado ya está guardado."
      actions={
        <>
          <button type="button" onClick={update} className={NOTICE_ACTION}>
            Actualizar ahora
          </button>
          <button type="button" onClick={dismiss} className={NOTICE_ACTION}>
            Ahora no
          </button>
        </>
      }
    />
  )
}
