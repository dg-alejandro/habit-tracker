# Progreso

Archivo de estado del proyecto. **Léelo al empezar cada sesión y actualízalo antes de terminarla.**
Es lo que permite que una instancia nueva sepa dónde estamos sin releer todo el código.

---

## Estado actual

**Fase en curso:** Fase 2 — Supabase y sincronización. Construida al completo (98 tests en verde, build limpio, revisor de estética pasado y sus hallazgos aplicados). Pendiente: verificación autenticada contra el Supabase real (necesita que el propietario teclee su contraseña en el navegador), variables en Vercel (SETUP §4) y prueba de aceptación PC ↔ iPhone.
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

- **Cierre de la Fase 2 (acciones del propietario):** (1) iniciar sesión en el navegador de verificación para la prueba autenticada; (2) limpiar la cuenta con un `truncate` de las 6 tablas antes de adoptar el dispositivo fuente (el navegador de pruebas habrá subido datos de relleno); (3) pegar las dos variables en Vercel y redesplegar (SETUP.md §4); (4) coreografía de adopción: el dispositivo cuyos datos de la Fase 1 se conservan sincroniza primero; el otro borra antes sus datos de sitio; (5) prueba de aceptación PC ↔ iPhone con modo avión.
- ~~Antes de la Fase 2: proyecto de Supabase y claves (SETUP.md §2)~~ — hecho el 2026-07-24: proyecto creado, claves en el `.env` local y SQL de §3 ejecutado por el propietario.

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
- **`@supabase/supabase-js` y `fake-indexeddb` (dev) añadidos** (Fase 2) — el cliente oficial del stack, y la única forma de correr Dexie REAL bajo Node en los tests de sincronización que el ROADMAP exige.
- **Espejo remoto en snake_case con PK `(user_id, id)` e `id text`** — el singleton `'settings'` no es un uuid. **Excepción: `entries` tiene PK `(user_id, habit_id, date)`** (su clave lógica) y su `id` queda como columna informativa: dos dispositivos creando la misma celda sin conexión convergen sin duplicados ni baile de ids. `order` viaja como `sort_order` (palabra reservada).
- **LWW por `updated_at` del cliente + trigger `lww_guard` + read-back** — el servidor descarta escrituras más antiguas (y estampa `synced_at`); tras cada subida se releen las filas y el perdedor se corrige a sí mismo. Cierra la divergencia por desfase de relojes en los dos sentidos.
- **`synced_at` del servidor como cursor de bajada** — keyset `(synced_at, id)` en páginas de 1000 con el cursor persistido por página en la MISMA transacción que su aplicación (un corte reanuda). El cursor solo avanza durante el pull, nunca en push ni read-back.
- **Outbox transaccional con coalescencia al flush** — cada escritura de repositorio encola en su misma transacción; el flush trabaja sobre un snapshot de seqs (una edición en vuelo re-encola con seq mayor y sobrevive). **La migración Dexie v2 encola todo lo existente**: el historial de la Fase 1 sube en el primer sync.
- **Borrados = soft-delete remoto (`deleted_at`), borrado local duro** — los upserts viajan con `deleted_at: null` (resurrección solo si la escritura viva es más nueva que el borrado). El mecanismo lo heredará el planificador de la Fase 4.
- **Siembra pospuesta cuando hay claves** — con Supabase configurado, `ensureSeeded` espera al primer pull completo con sesión y solo siembra si no bajó ningún hábito (evita 28 hábitos en un dispositivo nuevo). Sin claves, siembra inmediata como en la Fase 1. Con claves y sin sesión, pantalla vacía hasta el login.
- **La bajada escribe directo a Dexie, nunca re-encola** — regla única de aplicación: gana el `updated_at` más nuevo; en empate manda el servidor; el eco idéntico del propio push ni escribe ni re-renderiza (`sameRow`). Los registros se aplican por su clave lógica conservando el id local.
- **Import = reemplazo total con `updatedAt` bumpeado** — la copia restaurada gana por LWW en todas partes; se re-encola íntegro y los cursores vuelven a cero (cuenta y marca de primera bajada se conservan). Limitación consciente: una fila que exista en remoto pero no en la copia no se borra — la re-fusión LWW la trae de vuelta.
- **Motor tras un puerto `SyncBackend`** — el adaptador de supabase-js queda fino y sin tests propios (se verifica en navegador); los tests de integración inyectan un backend falso que modela el contrato del servidor (guardia LWW y `synced_at` monótono con grupos idénticos).
- **Sin realtime; multi-pestaña asumido** — el pull en arranque/visibilidad cumple el criterio de aceptación; un doble flush es idempotente. Riesgos anotados: el reloj del cliente es la autoridad LWW (dos dispositivos con hora de red); un reorden simultáneo en dos dispositivos puede dejar `order` duplicados (la UI ordena estable y el siguiente arrastre lo sana).
- **Carpeta nueva `components/settings/`** (§7) — secciones de la pantalla de Ajustes y el aviso de exportación (dominio, no primitiva). Los módulos de servicio `data/sync.ts` y `data/backup.ts` se consumen desde componentes como fachadas equiparables a repositorios — la regla de §2 apunta a Dexie/supabase-js crudos; la auth de la UI pasa por el hook `useAuth` (hallazgo del revisor de estética, corregido).
- **Indicador monocromo en dos variantes** — texto al pie del aside en escritorio; en móvil, insignia tipográfica (`·`/`!`) posicionada en absoluto en la esquina de la pestaña Ajustes para no mover la etiqueta al aparecer (hallazgo del revisor). El detalle de un error muestra el mensaje técnico como segunda línea atenuada: el único usuario es el propietario-desarrollador y le sirve para diagnosticar.
- **Aviso de exportación** — salta pasados 30 días lógicos desde `lastExportAt` o, si nunca se exportó, desde el `createdOn` más antiguo; vive al final del registro diario con el molde sobrio de FrozenDayBanner.
- **`.env` creado por el agente con marcadores** — la protección de `settings.json` deniega leer `.env*`, así que se escribió a ciegas y el propietario pegó los valores; `getSupabaseClient` exige que la URL empiece por `https://` para que los marcadores no rompan la app (modo solo-local limpio).

---

## Deuda técnica

Lo que se ha dejado a medias a propósito, para no olvidarlo.

- `public/favicon.svg` es provisional; los iconos y el manifest definitivos llegan con la PWA en la Fase 5.
- El gesto táctil del drag & drop no se pudo simular en el navegador de verificación (los eventos sintéticos no disparan los sensores de @dnd-kit); la persistencia del reorden sí está verificada de extremo a extremo. El gesto queda cubierto por la prueba manual del propietario en iPhone y PC.
- ~~`src/logic/smoke.test.ts` es un test de humo provisional~~ — saldada en la Fase 1: sustituido por `logic/dates.test.ts` y `logic/stats.test.ts` (51 tests).
- (Fase 2) La insignia móvil del indicador lleva `aria-hidden` y el aside no existe en móvil: el estado de sincronización es invisible para lectores de pantalla en iPhone. Asumido (usuario único vidente); revisar en la Fase 5 si el repaso de accesibilidad lo pide.
- (Fase 2) El bundle pasa de 500 KB minificados por supabase-js (~190 KB gzip en total). Sin partir por ahora; si el arranque en el iPhone se nota, se trocea en la Fase 5.
- (Fase 2) El modo avión no se pudo simular en el navegador de verificación (sin control del DevTools de red); la retención y el reintento están cubiertos por los tests de integración y el criterio de aceptación lo prueba el propietario en el iPhone.
- (Fase 2) La adopción inicial multi-dispositivo (dos dispositivos sembrados de forma independiente en la Fase 1) no tiene tooling en la app: se resuelve una sola vez a mano — `truncate` de las tablas, el dispositivo fuente sincroniza primero y el otro borra antes sus datos de sitio. Fuera del alcance de la fase; si algún día hiciera falta de nuevo, el export/import JSON cubre el caso.

---

## Registro de sesiones

Una entrada por sesión: fecha, fase, qué se hizo, qué quedó pendiente.

### 2026-07-24 — Fase 2 (construcción completa)
- Plan de la fase diseñado con exploración previa y agente arquitecto; dos agujeros de convergencia detectados en el diseño y cerrados: trigger `lww_guard` en el servidor (un dispositivo rezagado no pisa filas más nuevas) y read-back tras cada push (el perdedor de la guardia se corrige a sí mismo).
- `supabase/schema.sql` y `policies.sql`: 6 tablas espejo con `updated_at` (ms del cliente), `deleted_at`, `synced_at` estampado por trigger, índices keyset y RLS por `user_id`. El propietario creó el proyecto, ejecutó el SQL y pegó las claves en el `.env` durante la propia sesión.
- Capa local: Dexie `version(2)` (outbox + syncMeta) cuya migración encola todo el historial de la Fase 1; repositorios y semilla encolan en la misma transacción de cada escritura; `settingsRepo` nuevo.
- `logic/sync.ts` y `logic/backup.ts` (funciones puras con 22 tests) y `data/sync.ts`: motor single-flight con coalescencia por snapshot, push por lotes con read-back, pull keyset paginado con cursor transaccional, siembra pospuesta, guardia de cambio de cuenta, debounce/online/visibilidad/backoff. 19 tests de integración sobre fake-indexeddb con un backend falso que modela la guardia del servidor. Suite total: 98 en verde; build limpio.
- UI: página de Ajustes real (login de usuario único sin registro, estado detallado con reintento, exportar/importar JSON con confirmación en línea de dos pasos), indicador monocromo (aside + insignia en la pestaña móvil), aviso de exportación a los 30 días en el registro diario. Revisor de estética pasado: color impecable; su bloqueante (componente hablando con supabase-js) y 3 menores corregidos en el momento.
- Verificado en navegador: modo sin claves («Solo local», siembra inmediata, export con estampado) y modo con claves sin sesión («Sin sesión», formulario). Pendiente: verificación autenticada (el propietario debe teclear su contraseña), limpieza de la cuenta, Vercel §4 y aceptación PC ↔ iPhone con la coreografía de adopción anotada en *Bloqueos*.

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
