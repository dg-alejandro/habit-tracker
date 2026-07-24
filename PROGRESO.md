# Progreso

Archivo de estado del proyecto. **Léelo al empezar cada sesión y actualízalo antes de terminarla.**
Es lo que permite que una instancia nueva sepa dónde estamos sin releer todo el código.

---

## Estado actual

**Fase en curso:** Fase 2 — Supabase y sincronización (plan aprobado el 2026-07-24; en construcción).
**Última fase cerrada:** Fase 1 — Registro diario en local (2026-07-23)
**Última actualización:** 2026-07-24

---

## Fases

| Fase | Estado | Cerrada el | Notas |
|---|---|---|---|
| 0 — Esqueleto y despliegue | **Cerrada** | 2026-07-23 | Repo `dg-alejandro/habit-tracker` + Vercel; el propietario confirma que la URL navega en el iPhone |
| 1 — Registro diario en local | **Cerrada** | 2026-07-23 | Probada y dada por buena por el propietario el mismo día de su construcción (decisión suya, sin esperar las tres noches) |
| 2 — Supabase y sincronización | En curso | | |
| 3 — Rachas y estadísticas | Pendiente | | |
| 4 — Planificador semanal | Pendiente | | |
| 5 — Pulido y PWA | Pendiente | | |
| 6 — Notificación (opcional) | Pendiente | | |

Estados posibles: Pendiente · En curso · **Cerrada** · Bloqueada.
Una fase solo pasa a *Cerrada* cuando yo he probado su criterio de aceptación y lo confirmo.

---

## Bloqueos

Si hace falta una acción manual mía, anótala aquí y para.

- **Antes de la Fase 2 (acción manual del propietario):** crear el proyecto de Supabase y pasar las claves para el `.env` (SETUP.md §2). El SQL de §3 se ejecuta DURANTE la Fase 2, cuando exista el esquema, y las variables se pegan en Vercel (§4) al final. La Fase 2 se ejecuta en una sesión nueva de Claude Code (§8: una instancia por fase).

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
- **`dexie-react-hooks` añadido** (Fase 1) — el `useLiveQuery` oficial de Dexie; replicarlo a mano sobre `liveQuery` + `useSyncExternalStore` son ~40 líneas delicadas sin ganancia.
- **`@dnd-kit/sortable` y `@dnd-kit/utilities` además de `core`** (Fase 1) — la capa oficial de listas ordenables; el drag & drop del reordenado lo exige §5.2 y la Fase 4 la reutilizará.
- **`IsoDate` ('YYYY-MM-DD') se compara como string** — el orden lexicográfico es el cronológico; no existe helper de comparación. Y nunca `new Date('YYYY-MM-DD')`: el estándar lo parsea como UTC y desplaza un día en zonas negativas (helper interno de medianoche local en `logic/dates.ts`).
- **La suite de Vitest corre bajo `TZ=America/New_York`** — zona hostil que prueba que nada depende del dispositivo; comprobado empíricamente que Node en este Windows respeta la asignación en runtime (que es como la aplica Vitest).
- **Tipo de hábito inmutable tras la creación** — cambiar casilla ↔ contador corrompería el significado del historial; el formulario lo bloquea al editar.
- **Editar el objetivo de un contador no reescribe el historial** — `done` se fija contra el objetivo VIGENTE al escribir; los días pasados se quedan como estaban.
- **Desmarcar una casilla conserva la fila con `done=false`** — equivale a "sin registrar" para las estadísticas y evita tumbas de borrado en la sincronización de la Fase 2.
- **El check de los contadores es un indicador pasivo** — solo se cumple sumando minutos; no se puede forzar a mano. Corrección: tocar la cifra y fijar el total (0 = reset).
- **Archivados fuera de la vista diaria y del % semanal por completo** — sin prorrateos por archivado a mitad de semana; lo simple.
- **% semanal: `null` cuando no hay celdas y se muestra «—»** — una semana entera congelada no es un "0 %": ni suma ni rompe. Siempre en `streak-orange`; el resto del drama de color llega con las rachas en la Fase 3.
- **La semana del % es la de hoy lógico, aunque se navegue a otros días** — es "la semana en curso" de §5.1, no la del día visitado.
- **Los repositorios estampan `updatedAt`/`createdOn` ellos mismos** — la regla de inyectar el tiempo ata solo a `src/logic/`; enhebrar `now` por cada handler de UI no aporta nada.
- **Sin fila de `settings` sembrada** — nada la lee todavía; las constantes (`DEFAULT_GLOBAL_THRESHOLD`) mandan hasta que exista la pantalla de ajustes.
- **Desarchivar reincorpora al final de la lista** (`order = max + 1`) — evita colisiones de orden con la lista actual.
- **Congelar desde la pantalla diaria congela el día visitado** (rango de un día) — cubre "hoy" y el retroactivo suelto; descongelar ahí solo borra rangos exactos de un día, el resto se gestiona en /habitos.
- **Fechas mostradas con Intl `es-ES`** — date-fns queda solo para aritmética de calendario, sin importar sus locales.
- **Fondo negro en toda la app** (2026-07-23, petición del propietario) — se invierten los seis neutros de `tokens.css` y nada más: la prohibición de colores a mano convirtió el cambio de tema en seis valores. `color-scheme: dark` para que los controles nativos (fechas, números) rendericen oscuros, `theme-color` a juego y §6 de CLAUDE.md actualizado. Los chillones no cambian: sobre negro destacan aún más. El texto principal es #f0f0f0, no blanco puro, para no deslumbrar de noche.
- **Desarchivar no perdona los días archivados** — el modelo guarda un `archivedAt` puntual, sin histórico de intervalos; si se desarchiva a mitad de semana, los días intermedios cuentan como no cumplidos en el % (rellenables a posteriori, como cualquier día pasado). Lo simple, anotado a raíz de la revisión.
- **La regla de cumplido de contadores vive en `isCounterFulfilled` (`logic/stats.ts`)** — estaba duplicada en el repositorio de registros; el revisor de lógica la señaló y ahora es una función pura con tests que el repositorio consume.
- **`createHabit` valida el objetivo de los contadores** — la UI ya lo impedía; el repositorio también lo garantiza pensando en el import JSON de la Fase 5.

---

## Deuda técnica

Lo que se ha dejado a medias a propósito, para no olvidarlo.

- `public/favicon.svg` es provisional; los iconos y el manifest definitivos llegan con la PWA en la Fase 5.
- El gesto táctil del drag & drop no se pudo simular en el navegador de verificación (los eventos sintéticos no disparan los sensores de @dnd-kit); la persistencia del reorden sí está verificada de extremo a extremo. El gesto queda cubierto por la prueba manual del propietario en iPhone y PC.
- ~~`src/logic/smoke.test.ts` es un test de humo provisional~~ — saldada en la Fase 1: sustituido por `logic/dates.test.ts` y `logic/stats.test.ts` (51 tests).

---

## Registro de sesiones

Una entrada por sesión: fecha, fase, qué se hizo, qué quedó pendiente.

### 2026-07-23 — Cierre de las Fases 0 y 1
- El propietario confirma ambos criterios de aceptación: la URL de Vercel abre y navega en el iPhone (Fase 0) y el registro diario está probado y dado por bueno (Fase 1, cerrada el mismo día de su construcción por decisión suya, sin esperar las tres noches; cualquier fallo posterior se tratará como incidencia). Todo subido a GitHub.
- Siguiente paso: Fase 2 — Supabase y sincronización, en sesión nueva. Requiere antes SETUP.md §2 (proyecto de Supabase y claves para el `.env`).

### 2026-07-23 — Fase 1
- Registro diario en local completo: `logic/dates.ts` (día lógico con corte a las 4:00 vía Intl con `hourCycle h23`, semana ISO, Europe/Madrid) y `logic/stats.ts` (% semanal) con 51 tests bajo TZ hostil; modelo de datos completo en `data/types.ts` (hábitos, registros, congelados, planificador, ajustes); Dexie `version(1)` con las 6 tablas e índice único `[habitId+date]`; repositorios de hábitos, registros y congelados; semilla de los 14 hábitos.
- Pantalla de registro diario: % semanal enorme en `streak-orange`, navegación de días (atrás sin límite, nunca al futuro), tres tipos de hábito con fila-botón para casillas, contadores acumulables con corrección en línea, nota persistente, micro-animación CSS del tick y congelar/descongelar el día visitado.
- Pantalla de gestión: alta/edición en línea (tipo bloqueado al editar), reordenado con @dnd-kit y asa táctil, archivar/desarchivar y rangos congelados con fechas nativas.
- Verificado en navegador (viewport móvil y escritorio): marcado de los tres tipos, acumulación 15+15 → cumplido automático, recarga sin pérdida (IndexedDB), "ayer" sin hábitos (historial desde la creación), congelado con % en «—», alta/edición/archivado y reorden persistente. Nueva dependencia justificada en *Decisiones*.
- Revisores pasados. Estética: limpio (único color el % en `streak-orange`; su hallazgo menor de alturas táctiles quedó corregido a 44 px). Lógica: correcta en las siete reglas, con TZ hostil comprobada dentro del worker; sus hallazgos menores aplicados — tests de DST de la zona del dispositivo y de rango cruzando mes, canario de TZ, `isCounterFulfilled` como función pura y validación de objetivo al crear contadores (57 tests en verde).
- Fondo negro a petición del propietario, al cierre de la fase: neutros invertidos en `tokens.css`, `color-scheme: dark`, `theme-color` y §6 de CLAUDE.md actualizados; ningún componente tocado. Verificado en navegador (casillas, barra, naranja sobre negro).
- Pendiente: la prueba de aceptación del propietario (tres noches seguidas) y los pasos manuales de la Fase 0 (GitHub + Vercel), que siguen en *Bloqueos*.

### 2026-07-23 — Fase 0
- Esqueleto completo: Vite 8 + React 19 + TypeScript 7 estricto + Tailwind 4 + Vitest 4. Estructura de carpetas íntegra de §7 con stubs mínimos, tokens de color en `src/styles/tokens.css`, navegación entre las cinco secciones (barra inferior en móvil, lateral en escritorio, rutas en español), `.env.example`, `.gitignore` y README.
- Verificado en local: build y chequeo de tipos limpios, test de humo en verde, y en el navegador (viewport móvil y escritorio) las cinco rutas navegan con su pestaña activa y el catch-all redirige a `/`.
- `settings.json` y los dos revisores movidos a `.claude/`. Repo git iniciado en el proyecto (rama `main`). Ojo: existe un repo git accidental y sin commits en `C:\Users\Aleja` (el home entero); no se ha tocado.
- Pendiente: push a GitHub, deploy en Vercel y prueba de aceptación en el iPhone (ver Bloqueos).
