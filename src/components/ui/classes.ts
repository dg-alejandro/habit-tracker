/*
 * Clases compartidas de controles. Cadenas y no componentes: el llamante sigue
 * pudiendo concatenar lo que necesite (`${FIELD_CLASS} w-full`), que es lo que
 * hacían las cuatro copias que esto sustituye.
 *
 * Los textos de control van todos en `font-display` (§6): un botón es
 * estructura, no prosa. Antes convivían dos criterios y la misma acción se veía
 * en dos tipografías según la pantalla.
 */

/**
 * Campo de texto, número o fecha. Sin `w-full` en la base: el banco de tareas lo
 * omite a propósito (sus campos son `min-w-40 flex-1` y `w-20`), así que lo
 * añade quien lo quiere.
 *
 * Sin `focus:outline-none`, que es como estaba en tres de las cuatro copias:
 * mataría el anillo de foco global de index.css. El borde lima se queda como
 * señal de «escribes aquí», y el anillo lo pone la regla base.
 */
export const FIELD_CLASS =
  'h-11 rounded-sm border border-line bg-paper px-3 text-base text-ink placeholder:text-ink-faint focus:border-streak-lime'

/** Acción principal de un formulario: la que guarda. */
export const BUTTON_PRIMARY =
  'inline-flex h-11 items-center justify-center rounded-sm bg-ink px-5 font-display text-sm uppercase tracking-widest text-paper transition-opacity disabled:opacity-30'

/** Acción secundaria: cancelar, cerrar, alternar. */
export const BUTTON_QUIET =
  'inline-flex h-11 items-center justify-center rounded-sm px-4 font-display text-xs uppercase tracking-widest text-ink-soft transition-colors hover:bg-surface hover:text-ink'

/**
 * Lo que borra de verdad (§6). Siempre contorno, nunca relleno: el rojo de esta
 * app avisa, no invita a pulsarlo.
 */
export const BUTTON_DANGER =
  'inline-flex h-11 items-center justify-center rounded-sm border border-streak-red px-4 font-display text-xs uppercase tracking-widest text-streak-red transition-colors hover:bg-surface'

/** Acción dentro de una banda de aviso: subrayada, nunca un botón sólido. */
export const NOTICE_ACTION =
  'inline-flex h-11 items-center font-display text-xs uppercase tracking-widest text-ink underline underline-offset-4'
