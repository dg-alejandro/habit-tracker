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

/*
 * Navegación: barra inferior en móvil, lateral en escritorio.
 * La sección activa se marca con un filete lima; el resto sigue monocromo, así
 * que el color señala «estás aquí» y no adorna.
 */
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
                `relative flex h-14 min-w-0 items-center justify-center overflow-hidden border-t-2 px-0.5 font-display text-[10px] uppercase ${
                  isActive
                    ? 'border-t-streak-lime text-streak-lime'
                    : 'border-t-transparent text-ink-soft'
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
        <div className="mb-5 px-3 pt-2 font-display text-sm uppercase tracking-[0.3em] text-ink">
          Hábitos
        </div>
        {SECTIONS.map((section) => (
          <NavLink
            key={section.to}
            to={section.to}
            end={section.end}
            className={({ isActive }) =>
              `border-l-2 px-3 py-2 font-display text-xs uppercase tracking-widest transition-colors ${
                isActive
                  ? 'border-l-streak-lime bg-surface text-streak-lime'
                  : 'border-l-transparent text-ink-soft hover:bg-surface hover:text-ink'
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
