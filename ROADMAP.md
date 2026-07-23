# Roadmap

Seis fases. **Una instancia de Claude Code por fase.** No se empieza una sin que la anterior esté marcada como cerrada en `PROGRESO.md`.

Cada fase termina con: código funcionando, `PROGRESO.md` actualizado, commit hecho y una lista de qué debo probar yo.

---

## Fase 0 — Esqueleto y despliegue

**Objetivo:** que exista una URL que se abra en el iPhone. Vacía, pero real.

- Proyecto Vite + React + TypeScript estricto + Tailwind.
- Estructura de carpetas completa de `CLAUDE.md` §7, con archivos vacíos o mínimos.
- `src/styles/tokens.css` con la paleta: neutros y los tres colores chillones.
- Navegación entre las 5 páginas, vacías. Barra inferior en móvil, lateral en escritorio.
- `.env.example`, `.gitignore`, README inicial.
- Vitest configurado con un test trivial que pase.

**Depende de mí:** crear el repositorio en GitHub y conectarlo a Vercel (SETUP.md §1 y §4).

**Criterio de aceptación:** abro la URL de Vercel en el iPhone y navego entre las cinco secciones.

---

## Fase 1 — Registro diario en local

**Objetivo:** que la app sea usable esta misma noche. Sin Supabase todavía.

- `src/data/types.ts`: modelo completo de hábitos, registros, días congelados, tareas y plantillas. Define ahora todo el modelo aunque no se use hasta fases posteriores.
- Esquema Dexie y repositorios de hábitos y registros.
- `logic/dates.ts`: día lógico con corte a las 4:00, semana ISO de lunes a domingo, zona Europe/Madrid. **Con tests.**
- Pantalla de registro diario: los tres tipos de hábito, navegación a días anteriores, micro-animación al marcar.
- Pantalla de gestión de hábitos: crear, editar, reordenar, archivar, objetivo semanal.
- Semilla con los 14 hábitos precargados.
- Congelar días desde la pantalla diaria y desde gestión.
- Porcentaje semanal en cabecera, en color chillón. (Cálculo simple; las rachas llegan en la fase 3.)

**Criterio de aceptación:** registro tres noches seguidas sin fricción y sin perder datos al recargar.

> A partir de aquí uso la app a diario. Las estadísticas de la fase 3 no valen nada sin historial acumulado.

---

## Fase 2 — Supabase y sincronización

**Objetivo:** que PC e iPhone vean lo mismo. **Fase aislada: no añadas funcionalidades nuevas aquí.**

- `supabase/schema.sql` y `supabase/policies.sql`: tablas con `updated_at`, RLS por `user_id`.
- Auth con email y contraseña, sin confirmación por correo. Sesión persistente.
- `data/sync.ts`: cola de cambios pendientes, subida en segundo plano, bajada al arrancar, resolución por escritura más reciente. **Con tests.**
- Indicador de estado de sincronización.
- Exportar e importar JSON completo.
- Aviso de exportación pendiente si han pasado más de 30 días.

**Depende de mí:** crear el proyecto Supabase, pegar las claves, ejecutar el SQL, añadir las variables en Vercel (SETUP.md §2, §3 y §4).

**Criterio de aceptación:** marco un hábito en el PC, abro el iPhone y aparece. Pongo el móvil en modo avión, marco, lo quito, y se sincroniza solo.

---

## Fase 3 — Rachas y estadísticas

**Objetivo:** que mirar la pantalla dé pereza romper la racha.

- `logic/streaks.ts`, **con batería de tests amplia**: racha por hábito (estricta), racha global por umbral del 80 %, racha semanal contra el objetivo mínimo, récords, días congelados que ni suman ni rompen, hábitos creados a mitad de historial.
- `logic/stats.ts`: agregados por semana, mes y año.
- Pantalla de estadísticas: vista global y por hábito.
- Gráficas con Recharts. Heatmap anual con CSS puro.
- Historial de notas del hábito de aprendizaje.
- **Aquí entran los colores chillones**: racha global enorme, y el aviso rojo al romper una racha.
- Umbral de racha global configurable en ajustes.

**Criterio de aceptación:** los tests de rachas cubren los casos raros (congelados, hábito nuevo, día sin registrar, cambio de mes y de año) y las cifras cuadran con mi historial real.

---

## Fase 4 — Planificador semanal

**Objetivo:** poder planificar un domingo de verdad con él.

- Repositorios de tareas y plantillas.
- `logic/planner.ts`: semana ISO, generación de tareas desde plantillas, arrastre de tareas no completadas al inbox siguiente con su contador. **Con tests.**
- Inbox semanal + cuadrícula de 7 días.
- Cuadrícula horaria 00:00–24:00 en bloques de 30 min, con la franja nocturna plegada por defecto.
- Drag & drop con @dnd-kit: inbox → día, día → bloque horario.
- Creación rápida con Enter, edición en línea, completar tareas.
- Pantalla de gestión de plantillas de tarea fija.
- Duplicar la semana anterior.
- Vista móvil: un día cada vez.

**Criterio de aceptación:** planifico una semana completa desde el iPhone sin abrir el PC.

---

## Fase 5 — Pulido y PWA

- `vite-plugin-pwa`: manifest, service worker, icono, splash screen.
- Estados de carga, estados vacíos, manejo de errores de red.
- Repaso de accesibilidad táctil y contraste.
- Revisión general de la estética contra `CLAUDE.md` §6.

**Depende de mí:** instalar la PWA en el iPhone (SETUP.md §5).

**Criterio de aceptación:** la app instalada en la pantalla de inicio es indistinguible de una app nativa.

---

## Fase 6 — Notificación nocturna (opcional)

Solo si todo lo anterior está sólido. **Si se complica, se abandona sin drama.**

- Service worker con push, claves VAPID, suscripción guardada en Supabase.
- Cron diario en Vercel que dispara el aviso a la hora configurada.
- Hora configurable en ajustes.

**Depende de mí:** generar las claves VAPID y añadirlas a Vercel (SETUP.md §6).

**Criterio de aceptación:** recibo el aviso en el iPhone a la hora fijada, con la app cerrada.
