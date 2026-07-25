import { useState, type FormEvent, type KeyboardEvent } from 'react'

interface QuickAddFieldProps {
  placeholder: string
  /** Nombre accesible: en escritorio hay siete campos con el mismo texto visible. */
  label: string
  onSubmit: (text: string) => void
}

/**
 * Creación rápida de §4: escribir y Enter. Sin modales ni formularios.
 * El campo se vacía y mantiene el foco para poder volcar tres ideas seguidas.
 *
 * El Enter se atiende a mano ADEMÁS de por el submit del formulario: el envío
 * implícito de un formulario sin botón no es fiable —y en iOS la tecla del
 * teclado virtual menos aún—, y aquí no cabe un botón «Añadir» sin estropear
 * el gesto de volcar ideas seguidas.
 */
export function QuickAddField({ placeholder, label, onSubmit }: QuickAddFieldProps) {
  const [text, setText] = useState('')

  const commit = () => {
    const trimmed = text.trim()
    if (trimmed === '') return
    onSubmit(trimmed)
    setText('')
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    commit()
  }

  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    commit()
  }

  return (
    <form onSubmit={submit}>
      <input
        type="text"
        value={text}
        onChange={(event) => setText(event.currentTarget.value)}
        onKeyDown={keyDown}
        placeholder={placeholder}
        aria-label={label}
        enterKeyHint="done"
        autoCapitalize="sentences"
        className="h-11 w-full rounded-sm border border-line bg-paper px-3 text-base text-ink placeholder:text-ink-faint"
      />
    </form>
  )
}
