/// <reference types="vite/client" />
/* `vite-plugin-pwa/react` y no `/client`: el primero es el que declara el
   módulo virtual `virtual:pwa-register/react` y el tipo de useRegisterSW.
   Con `/client` el import quedaría en `any` implícito y no compilaría. */
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  /** Project URL de Supabase (SETUP.md §2). Ausente = la app funciona solo en local. */
  readonly VITE_SUPABASE_URL?: string
  /** Clave anon/publishable de Supabase. Pública por diseño: RLS protege los datos. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
