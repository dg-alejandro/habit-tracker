import { NavLink } from 'react-router'
import { SyncIndicator } from './SyncIndicator'

interface Section {
  to: string
  /** Etiqueta corta para la barra inferior del móvil */
  short: string
  /** Etiqueta completa para la barra lateral de escritorio */
  full: string
  end?: boolean
}

const SECTIONS: Section[] = [
  { to: '/', short: 'Registro', full: 'Registro diario', end: true },
  { to: '/habitos', short: 'Hábitos', full: 'Hábitos' },
  { to: '/estadisticas', short: 'Rachas', full: 'Rachas y estadísticas' },
  { to: '/planificador', short: 'Plan', full: 'Planificador' },
  { to: '/ajustes', short: 'Ajustes', full: 'Ajustes' },
]

/* Navegación monocroma: barra inferior en móvil, lateral en escritorio. */
export function NavBar() {
  return (
    <>
      {/* Móvil — objetivos táctiles grandes, con hueco para el gesto del iPhone */}
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="grid grid-cols-5">
          {SECTIONS.map((section) => (
            <NavLink
              key={section.to}
              to={section.to}
              end={section.end}
              className={({ isActive }) =>
                `flex h-14 items-center justify-center text-xs ${
                  isActive ? 'font-semibold text-ink' : 'text-ink-soft'
                }`
              }
            >
              {section.short}
              {section.to === '/ajustes' && <SyncIndicator variant="tab" />}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Escritorio */}
      <aside className="hidden border-r border-line md:sticky md:top-0 md:flex md:h-dvh md:w-56 md:shrink-0 md:flex-col md:gap-1 md:p-4">
        <div className="mb-4 px-3 pt-2 text-lg font-semibold tracking-tight">Hábitos</div>
        {SECTIONS.map((section) => (
          <NavLink
            key={section.to}
            to={section.to}
            end={section.end}
            className={({ isActive }) =>
              `rounded-md px-3 py-2 text-sm ${
                isActive
                  ? 'bg-surface font-medium text-ink'
                  : 'text-ink-soft hover:bg-surface hover:text-ink'
              }`
            }
          >
            {section.full}
          </NavLink>
        ))}
        <SyncIndicator variant="aside" />
      </aside>
    </>
  )
}
