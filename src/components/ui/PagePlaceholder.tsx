interface PagePlaceholderProps {
  title: string
  /** Fase del roadmap en la que se construye la sección */
  phase: string
}

/* Shell provisional de cada sección hasta que le llegue su fase. */
export function PagePlaceholder({ title, phase }: PagePlaceholderProps) {
  return (
    <div className="px-5 py-8 md:px-10 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-ink-soft">Esta sección se construye en la {phase}.</p>
    </div>
  )
}
