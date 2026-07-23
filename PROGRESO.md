# Progreso

Archivo de estado del proyecto. **Léelo al empezar cada sesión y actualízalo antes de terminarla.**
Es lo que permite que una instancia nueva sepa dónde estamos sin releer todo el código.

---

## Estado actual

**Fase en curso:** Fase 0 — Esqueleto y despliegue (código construido y verificado en local; pendiente de GitHub, Vercel y prueba en iPhone)
**Última fase cerrada:** ninguna
**Última actualización:** 2026-07-23

---

## Fases

| Fase | Estado | Cerrada el | Notas |
|---|---|---|---|
| 0 — Esqueleto y despliegue | En curso | | Código listo y commiteado; falta repo GitHub + Vercel (SETUP §1 y §4) |
| 1 — Registro diario en local | Pendiente | | |
| 2 — Supabase y sincronización | Pendiente | | |
| 3 — Rachas y estadísticas | Pendiente | | |
| 4 — Planificador semanal | Pendiente | | |
| 5 — Pulido y PWA | Pendiente | | |
| 6 — Notificación (opcional) | Pendiente | | |

Estados posibles: Pendiente · En curso · **Cerrada** · Bloqueada.
Una fase solo pasa a *Cerrada* cuando yo he probado su criterio de aceptación y lo confirmo.

---

## Bloqueos

Si hace falta una acción manual mía, anótala aquí y para.

- **Fase 0 — esperando acción manual:** (1) crear el repositorio privado en GitHub, en la cuenta personal, y pasar la URL (SETUP.md §1) → entonces Claude hace `git remote add` y el push; (2) importar el repositorio en Vercel con la configuración por defecto de Vite (SETUP.md §4). El código está commiteado en local, listo para el push.

---

## Decisiones tomadas

Toda decisión no especificada en `CLAUDE.md` se anota aquí con una línea de justificación.

- **Local-first en vez de escribir directo a Supabase** — la app se usa de noche, a veces con mala cobertura; no puede perderse un marcado.
- **Contraseña en vez de magic link** — el enlace mágico abre Safari fuera de la PWA instalada y el envío de emails del plan gratuito está limitado. La sesión persistente hace que solo se escriba una vez por dispositivo.
- **Racha global por umbral y no por día perfecto** — con 14 hábitos, exigir el pleno dejaría la racha global siempre a cero y perdería todo su valor motivador.
- **Rachas por hábito estrictas** — cada hábito individual sí es alcanzable a diario.
- **El día cierra a las 4:00** — marcar a la 1:00 de la madrugada debe contar como el día que acaba de terminar.
- **Semana de lunes a domingo** — el planificador se rellena el domingo por la noche para la semana que empieza.
- **Planificador independiente de los hábitos** — son dos herramientas distintas; mezclarlas complica ambas.
- **Tareas fijas por plantilla en vez de repetición por tarea** — separa el catálogo de lo que ocurre en una semana concreta, y permite editar una semana sin romper el patrón.
- **Franja 00:00–06:00 plegada por defecto** — una cuadrícula de 48 bloques es ingobernable en móvil si se muestra entera.
- **Código en inglés, interfaz y documentación en español** — mezclar idiomas dentro del código genera más fricción que la que ahorra.
- **`react-router` como router (no estaba en la tabla del stack)** — cinco secciones con URL real, botón atrás del iPhone y deep-links en la futura PWA; un router a mano ahorraría una dependencia pero arriesga más de lo que ahorra. Instalada la v8, que mantiene la API declarativa (`BrowserRouter`/`Routes`/`NavLink`).
- **Rutas en español** (`/habitos`, `/estadisticas`, `/planificador`, `/ajustes`) — la URL también es interfaz de usuario.
- **Navegación solo con texto, sin librería de iconos** — evita una dependencia en la Fase 0; se revisará en la Fase 5 (pulido).
- **Tailwind 4 con los tokens en un bloque `@theme` de `tokens.css` y la paleta por defecto desactivada** (`--color-*: initial`) — solo existen las clases de color derivadas de los tokens; un `text-red-500` no compila a nada, lo que hace estructural la regla de color de §6.
- **`settings.json` y los revisores movidos a `.claude/`** — es la ubicación que espera Claude Code (`.claude/settings.json` según §7 y `.claude/agents/` para los subagentes); en la raíz no tenían efecto.
- **`noUncheckedIndexedAccess` activado** además del estricto estándar — los accesos por índice (mapas por fecha, arrays de rachas) obligan a comprobar `undefined`; retrofitarlo con la lógica ya escrita sería doloroso.

---

## Deuda técnica

Lo que se ha dejado a medias a propósito, para no olvidarlo.

- `src/logic/smoke.test.ts` es un test de humo provisional; la Fase 1 lo sustituye por los tests reales de `logic/dates.ts`.
- `public/favicon.svg` es provisional; los iconos y el manifest definitivos llegan con la PWA en la Fase 5.

---

## Registro de sesiones

Una entrada por sesión: fecha, fase, qué se hizo, qué quedó pendiente.

### 2026-07-23 — Fase 0
- Esqueleto completo: Vite 8 + React 19 + TypeScript 7 estricto + Tailwind 4 + Vitest 4. Estructura de carpetas íntegra de §7 con stubs mínimos, tokens de color en `src/styles/tokens.css`, navegación entre las cinco secciones (barra inferior en móvil, lateral en escritorio, rutas en español), `.env.example`, `.gitignore` y README.
- Verificado en local: build y chequeo de tipos limpios, test de humo en verde, y en el navegador (viewport móvil y escritorio) las cinco rutas navegan con su pestaña activa y el catch-all redirige a `/`.
- `settings.json` y los dos revisores movidos a `.claude/`. Repo git iniciado en el proyecto (rama `main`). Ojo: existe un repo git accidental y sin commits en `C:\Users\Aleja` (el home entero); no se ha tocado.
- Pendiente: push a GitHub, deploy en Vercel y prueba de aceptación en el iPhone (ver Bloqueos).
