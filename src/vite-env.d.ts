/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Project URL de Supabase (SETUP.md §2). Ausente = la app funciona solo en local. */
  readonly VITE_SUPABASE_URL?: string
  /** Clave anon/publishable de Supabase. Pública por diseño: RLS protege los datos. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
