# Hábitos

Aplicación web personal de seguimiento de hábitos y planificación semanal. Un solo usuario, local-first, usada desde PC y iPhone con datos sincronizados.

- **Qué se construye y con qué reglas:** [CLAUDE.md](CLAUDE.md)
- **Fases y criterios de aceptación:** [ROADMAP.md](ROADMAP.md)
- **Estado actual:** [PROGRESO.md](PROGRESO.md)
- **Pasos manuales del propietario:** [SETUP.md](SETUP.md)

## Stack

Vite · React · TypeScript estricto · Tailwind CSS · Dexie (IndexedDB) · Supabase · Vercel

## Desarrollo

```bash
npm install        # instalar dependencias
npm run dev        # servidor de desarrollo
npm test           # tests (Vitest)
npm run build      # build de producción (incluye chequeo de tipos)
npm run preview    # servir el build localmente
```

Requiere Node 20 o superior.

## Variables de entorno

Copiar `.env.example` a `.env` y rellenar las claves de Supabase (a partir de la Fase 2; ver `SETUP.md` §2). El `.env` nunca se sube al repositorio.

## Despliegue

Vercel (plan Hobby), conectado al repositorio: cada push a `main` despliega solo. Framework: Vite, configuración por defecto. Ver `SETUP.md` §4.
