import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { NoticeBanner } from './NoticeBanner'
import { NOTICE_ACTION } from './classes'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Título del aviso. Por defecto, el genérico de pantalla rota. */
  title?: string
  /** Frase de contexto propia; si falta, la genérica de «no se ha borrado nada». */
  detail?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Límite de error. Hasta la Fase 5 no había ninguno en toda la app, y eso
 * significaba que cualquier excepción durante el render dejaba `#root` vacío:
 * pantalla negra, sin navegación y sin forma de recuperarse.
 *
 * Y no son fallos hipotéticos. `useLiveQuery` relanza durante el render los
 * errores de Dexie (IndexedDB no disponible, cuota agotada), `logic/dates.ts`
 * lanza ante una fecha malformada y `logic/streaks.ts` ante una semana sin
 * lunes: basta una fila corrupta llegada por sincronización o por importación.
 *
 * El aviso NO usa `streak-red`: el rojo está reservado a la ruptura de rachas y
 * a los borrados (§6). Una pantalla rota es grave, pero no es eso.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // El único usuario de esta app es quien la programa: la consola es útil.
    console.error('Error no controlado en el render:', error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state
    if (error === null) return this.props.children

    const stack = error.stack ?? ''

    return (
      <div className="mx-auto max-w-xl px-5 py-6 md:px-10 md:py-10">
        <NoticeBanner
          role="alert"
          tone="alert"
          title={this.props.title ?? 'Algo se ha roto'}
          detail={
            this.props.detail ??
            'Tus datos están a salvo en este dispositivo. No se ha borrado nada.'
          }
          actions={
            <>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className={NOTICE_ACTION}
              >
                Recargar
              </button>
              {/*
               * Esta es la salida de emergencia de verdad, y es deliberada.
               * Si lo que ha reventado es una fila corrupta, recargar vuelve a
               * caer en el mismo error — pero /ajustes no pasa por
               * logic/dates.ts: la copia de seguridad lee las tablas en crudo.
               * Con la app rota, exportar el JSON sigue funcionando, y §9 dice
               * que ese JSON es el único respaldo que existe.
               */}
              <Link to="/ajustes" className={NOTICE_ACTION}>
                Ir a Ajustes y exportar la copia
              </Link>
            </>
          }
        />
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words font-display text-xs text-ink-soft">
          {error.message}
          {stack === '' ? '' : `\n\n${stack.split('\n').slice(0, 6).join('\n')}`}
        </pre>
      </div>
    )
  }
}
