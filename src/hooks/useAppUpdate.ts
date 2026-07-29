import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Cada cuánto se le pregunta al servidor si hay versión nueva. */
const CHECK_EVERY_MS = 60 * 60 * 1000

export interface AppUpdate {
  /** Hay un service worker esperando: toca avisar. */
  needRefresh: boolean
  /** Activa el service worker nuevo y recarga. */
  update: () => void
  /** Cierra el aviso sin actualizar; volverá a salir al reabrir la app. */
  dismiss: () => void
}

/**
 * Registro del service worker y detección de versión nueva.
 *
 * Vive en `hooks/` y no en `components/ui/` porque es la convención del repo
 * para suscribirse a algo del navegador (useSession, useIsDesktop, useOnline), y
 * porque la Fase 6 necesitará este mismo `registration` para el push.
 *
 * La app se registra en modo `prompt` (decisión del propietario): la versión
 * nueva NO entra sola. Se marca hábitos de noche y una recarga a media
 * interacción es intolerable.
 */
export function useAppUpdate(): AppUpdate {
  const timer = useRef<number | null>(null)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration === undefined) return
      /*
       * Comprobación periódica, y no solo al arrancar. Una PWA instalada en el
       * iPhone puede pasar días sin cerrarse del multitarea: sin esto, el aviso
       * de versión nueva no llegaría nunca porque la página no se recarga.
       */
      timer.current = window.setInterval(() => {
        void registration.update()
      }, CHECK_EVERY_MS)
    },
  })

  useEffect(() => {
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') {
        void navigator.serviceWorker?.getRegistration().then((registration) => {
          void registration?.update()
        })
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      if (timer.current !== null) window.clearInterval(timer.current)
    }
  }, [])

  return {
    needRefresh,
    update: () => void updateServiceWorker(true),
    dismiss: () => setNeedRefresh(false),
  }
}
