# Progreso

Archivo de estado del proyecto. **Léelo al empezar cada sesión y actualízalo antes de terminarla.**
Es lo que permite que una instancia nueva sepa dónde estamos sin releer todo el código.

---

## Estado actual

**Fase en curso:** Fase 4 — Planificador semanal. El modelo se ha rehecho **cuatro veces** el 2026-07-25 hasta dar con lo que el propietario quería; el de ahora es el bueno y está descrito entero en `CLAUDE.md` §4. **No inventes variantes: lee §4 y respétala.** 276 tests en verde, build limpio, verificado en navegador. Pendiente de la **prueba de aceptación del propietario**.

**El planificador, en una frase:** un banco de tareas reutilizables del que se tira arrastrando, una caja para lo suelto de la semana, y una cuadrícula donde se coloca todo. El banco no recuerda posiciones y ninguna semana hereda nada de la anterior.

**Ojo al criterio de aceptación del ROADMAP para esta fase** («planifico una semana completa desde el iPhone sin abrir el PC»): el propietario ha aclarado que su uso real es **montar la semana en el PC** y usar el iPhone para consultar y marcar. El criterio está pendiente de reescribirse.
**También pendiente:** la aceptación de la Fase 3 (sus cifras contra el historial real). Las dos pruebas son independientes.
**Última fase cerrada:** Fase 2 — Supabase y sincronización (2026-07-24)
**Última actualización:** 2026-07-25

**La rama `fase-4` nunca existió.** La sesión paralela que preveía la nota del 2026-07-24 no llegó a producir nada (`git branch -a` y `git worktree list` solo muestran `main`), así que la Fase 4 se ha construido sobre `main`, encima de la Fase 3. No hay nada que fusionar.

---

## Fases

| Fase | Estado | Cerrada el | Notas |
|---|---|---|---|
| 0 — Esqueleto y despliegue | **Cerrada** | 2026-07-23 | Repo `dg-alejandro/habit-tracker` + Vercel; el propietario confirma que la URL navega en el iPhone |
| 1 — Registro diario en local | **Cerrada** | 2026-07-23 | Probada y dada por buena por el propietario el mismo día de su construcción (decisión suya, sin esperar las tres noches) |
| 2 — Supabase y sincronización | **Cerrada** | 2026-07-24 | El propietario confirma completado su checklist de *Bloqueos* («mi parte está hecha»): verificación autenticada, Vercel y prueba PC ↔ iPhone |
| 3 — Rachas y estadísticas | En curso (construida; aceptación pendiente) | | Código completo y en GitHub; falta que el propietario compruebe sus cifras reales |
| 4 — Planificador semanal | En curso (rehecha; aceptación pendiente) | | Banco de tareas + cuadrícula, y pasada de estética sobre toda la app |
| 5 — Pulido y PWA | Pendiente | | |
| 6 — Notificación (opcional) | Pendiente | | |

Estados posibles: Pendiente · En curso · **Cerrada** · Bloqueada.
Una fase solo pasa a *Cerrada* cuando yo he probado su criterio de aceptación y lo confirmo.

---

## Bloqueos

Si hace falta una acción manual mía, anótala aquí y para.

- ~~Cierre de la Fase 2 (acciones del propietario)~~ — **hecho el 2026-07-24**: el propietario confirma su checklist completo («mi parte está hecha»): verificación autenticada en navegador, limpieza de la cuenta si procedía, variables en Vercel, coreografía de adopción y prueba PC ↔ iPhone. La fase se cierra sobre esa confirmación (el criterio de aceptación lo prueba él, según ROADMAP); el adaptador real de Supabase queda ejercitado por su uso real, sin re-verificación del agente (no maneja su contraseña).
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
- **(Fase 3) Hoy pendiente no rompe** — toda racha se evalúa estricta hasta ayer; hoy suma si ya cumple y sin marcar queda pendiente (el día no cierra hasta las 4:00). En la racha semanal, la semana en curso es tri-estado: `achieved` suma, `pending` (aún alcanzable) ni suma ni rompe, `lost` cae a 0 en cuanto es matemáticamente imposible — sin esperar al domingo («que duela»); rellenar días pasados la resucita al recalcular.
- **(Fase 3) Récords recalculados, nunca persistidos** — récord = máximo del historial completo (racha actual incluida). Determinista entre dispositivos con LWW y relleno retroactivo. Contrapartida asumida y pinneada con test: congelar retroactivamente sobre la mejor racha, editar el pasado o cambiar el umbral puede REDUCIR un récord.
- **(Fase 3) Racha global con el estado ACTUAL de archivado, retroactivo** — elegibles de un día = activos hoy con `createdOn <= día` (no hay historial de archivado en el esquema; coherente con el % semanal de la Fase 1). Archivar puede resucitar la racha global pasada; desarchivar reintroduce el hueco como fallos. Los archivados conservan sus rachas en su vista propia.
- **(Fase 3) Objetivo semanal efectivo `min(weeklyTarget, días elegibles)`** — elegible = no congelado y `>= createdOn`. Semana con 0 elegibles se salta ANTES de comparar (sin el guard, `min(t,0)=0` marcaría lograda una semana entera congelada). En semanas muy congeladas endurece la proporción (2 elegibles → 2/2); la alternativa proporcional se descartó por complejidad.
- **(Fase 3) Día global sin hábitos elegibles = saltado** — como un congelado: ni suma, ni rompe, ni consume la ventana del aviso.
- **(Fase 3) Aviso de ruptura solo en rachas diarias** — `recentlyBroken` con racha perdida mínima de 2 días y ventana de 7 días ABIERTOS (los congelados no la consumen: volver de vacaciones aún avisa e invita a rellenar). La semanal comunica con el estado `lost` de la semana en curso. Empatar el récord también marca `isRecord`.
- **(Fase 3) Empate exacto con el umbral cuenta (`>=` sobre división IEEE)** — y `requiredForThreshold` deriva el «X de N» de Ajustes de la misma comparación (un `ceil(umbral·n)` ingenuo falla con flotantes: `ceil(0.8·15) = 13`, cuando 12/15 ya pasa).
- **(Fase 3) El numerador global filtra registros anteriores al alta de su hábito** (hallazgo del revisor de rachas) — un `done` fechado antes del `createdOn` de su hábito no infla días en los que ese hábito no está en el denominador (solo alcanzable con datos anómalos: import JSON o carreras de LWW).
- **(Fase 3) Nivel máximo del heatmap ligado al umbral configurable** — nivel 4 ⟺ día logrado (mismo criterio que la racha global); cambiar el umbral repinta el año entero. Escala: surface → naranja /30 /55 /80 → lime pleno; congelado gris tenue; futuro y pre-historial invisibles.
- **(Fase 3) Política de capas con archivados** — las funciones solo-globales (`computeGlobalStreak`, `computeGlobalHeatmap`, `computeWeeklyPercentage`) filtran archivados DENTRO; las compartidas (`countCompletionCells`, series) reciben los hábitos ya filtrados por el caller, y así sirven también a la vista por hábito de un archivado («archivar conserva estadísticas»).
- **(Fase 3) Vista por hábito con estado local** (`selectedHabitId`), sin ruta nueva — lo simple; la lista de la vista global es la puerta de entrada.
- **(Fase 3) `Stats` con `React.lazy`** — Recharts (94 KB gzip) queda en un chunk aparte que no pesa en el arranque del registro diario nocturno.
- **(Fase 3) Recharts instalado** — ya estaba elegido en el stack de CLAUDE.md §2; no es dependencia nueva.
- **(Fase 3) Reparto de los chillones** — racha global en `streak-lime`, récords en `streak-magenta`, % semanal, series y rachas por hábito en `streak-orange`, y `streak-red` para la ruptura de racha (número 0 cayendo con `streak-fall`, banner con borde rojo y semana `lost`). *Enmendado en la Fase 4:* `streak-red` cubre también las tareas arrastradas 3+ semanas, que §4 pide en rojo explícitamente.
- **(Fase 4) `IsoWeekday` se muda a `logic/dates.ts`** y `data/types.ts` lo reexporta, como ya hacía con `IsoDate` y `WeekId` — es un concepto de calendario y las firmas de los helpers de semana lo necesitan; al revés habría ciclo de imports.
- **(Fase 4) `WeekId` se compara como string**, igual que `IsoDate`: `RRRR-'W'II` lleva el año de NUMERACIÓN ISO y la semana con cero, así que el orden lexicográfico es el cronológico incluso cruzando año. Fijado con un test-canario. El lunes de una semana sale del ancla del 4 de enero, que siempre cae en la W01.
- **(Fase 4) Materialización perezosa con marcador DERIVADO** — no hay cron: al abrir una semana se generan sus tareas fijas, y solo si es presente o futura **y no tiene ninguna tarea**. Cero esquema nuevo y cero SQL (que habría sido un paso manual del propietario). Contrapartidas asumidas: vaciar del todo una semana presente o futura hace que vuelvan sus fijas, y una semana pasada que nunca se abrió se ve vacía para siempre (no se fabrica historia retroactiva).
- **(Fase 4) Id determinista de la tarea generada: `tpl:<plantilla>:<semana>`** — el `id` remoto es `text`, no uuid. Dos dispositivos que materialicen la misma semana producen la MISMA fila y la guardia LWW la colapsa, en vez de dejar dos copias de cada tarea fija. También hace idempotente el doble efecto de `StrictMode`.
- **(Fase 4) Generar ANTES de arrastrar, en una sola transacción** — no es preferencia: al revés, las tareas arrastradas dejarían la semana «no vacía» y las plantillas no se generarían nunca más.
- **(Fase 4) La preparación automática de la semana espera a una bajada completa** cuando hay sesión, sin plazo de gracia. Genera y mueve filas sin que el usuario toque nada, y con resolución por última escritura un dispositivo desactualizado regeneraría una tarea fija que el otro había editado o borrado, y ganaría. Sin conexión el planificador sigue siendo usable a mano; lo automático espera (hallazgo del revisor de lógica).
- **(Fase 4) `carriedOverCount` sube las semanas REALMENTE transcurridas, no una por evento** — §4 dice «incrementado en uno», pero si no se abre el planificador en cinco semanas la tarea llegaría marcando 1 y no dispararía el rojo, que es justo cuando más tiene que gritar. La etiqueta cuenta arrastres («Arrastrada 3 semanas») para que insignia y umbral digan lo mismo.
- **(Fase 4) Las tareas de plantilla no completadas se quedan en su semana** (decisión del propietario) — §4 dice «desaparecen», pero lo normativo es «no se arrastran»; la app no borra nada sola. Coste: ~520 filas al año con 10 plantillas, irrelevante.
- **(Fase 4) Duplicar la semana anterior copia solo las COMPLETADAS** — las pendientes ya viajan solas con el arrastre, así que copiarlas dejaría cada tarea dos veces en la semana destino: la copia con su día y su hora, y el original al arrastrarse al inbox. Es exactamente el caso de uso del domingo (hallazgo del revisor de lógica).
- **(Fase 4) Solapar tareas es legítimo** — nada se rechaza ni se desplaza: `layoutDayTasks` reparte carriles por grupo conexo y los chips se ven a media anchura. Una tarea que desborda medianoche se guarda tal cual y se pinta recortada, en vez de moverle la hora a algo que nadie pidió.
- **(Fase 4) El inbox no es reordenable a mano** — no hay columna `order` en `planner_tasks` y no se toca el SQL. El orden es derivado y determinista (pendientes primero, luego las más arrastradas, luego por hora y por texto), que además es lo correcto entre dispositivos.
- **(Fase 4) Tope de 24 h en la duración estimada** — la columna remota es `integer`: un número disparatado tecleado en el campo se guardaría en local y luego reventaría el push contra Postgres, dejando la cola de subida atascada para siempre (hallazgo del revisor de lógica).
- **(Fase 4) Ruta propia `/planificador/plantillas`** en vez del estado local que usó la Fase 3 — el botón atrás del iPhone tiene que servir. `NavBar` declara `/planificador` sin `end`, así que la pestaña sigue activa en la subruta.
- **(Fase 4) La cuadrícula rompe el `max-w-xl` común** (`md:max-w-5xl`): siete columnas no caben. Primera pantalla que lo hace.
- **(Fase 4) Densidad doble de la fila de tarea** — cómoda (44 px de asa y casilla) en el inbox y en los días de móvil; compacta en las siete columnas de escritorio, donde una fila cómoda dejaba el texto en tres caracteres (hallazgo del revisor de estética). El editor completo vive en una banda a ancho completo de la página, no dentro de la columna, por lo mismo.
- **(Fase 4) Sensores de arrastre separados** — `MouseSensor` por distancia de 8 px y `TouchSensor` por pulsación larga de 220 ms. Un umbral de distancia con el dedo convertiría cualquier desliz sobre un chip en un arrastre y mataría el scroll del iPhone. Colisión por `pointerWithin` (`closestCenter` engancha la celda equivocada en bloques de 28 px).
- **(Fase 4) Todo lo que se hace arrastrando se puede hacer sin arrastrar** — el editor lleva selectores de día y de hora. Es la red que salva el criterio de aceptación si el gesto falla en el iPhone, donde no se ha podido verificar.
- **(Fase 4) La vista móvil de un día se decide en JS (`useIsDesktop`), no con `hidden md:`** — renderizar los dos árboles duplicaría las zonas de soltado, y dnd-kit no admite dos con el mismo identificador. Por lo mismo, las letras del selector móvil son zonas de soltado salvo la del día ya montado abajo.
- **(Fase 4) El alta rápida atiende el Enter a mano** además del submit del formulario — el envío implícito de un formulario sin botón no es fiable, y en iOS la tecla del teclado virtual menos aún; y aquí no cabe un botón «Añadir» sin estropear el gesto de volcar ideas seguidas.


### Rediseño del 2026-07-25 (petición del propietario)

**Aviso para quien lea esto en otra sesión: el modelo del planificador se rehízo CUATRO veces el mismo día.** Lo que sigue es el resultado, no el camino. Las versiones descartadas —catálogo de tareas fijas con varios días; alta dentro de cada día; tareas «persistentes» que reaparecían solas en el mismo hueco— **ya no existen**; si algo en el código huele a ellas, es un resto que hay que limpiar.

Lo que el propietario quería, y que costó cuatro intentos entender: **un banco de tareas reutilizables**. Escribir no obliga a decidir cuándo, colocar es arrastrar, y lo que se repite se guarda una vez y se saca del banco cada semana **sin que el banco recuerde dónde estuvo**.

- **Caja + cuadrícula, y nada más.** Fuera las listas por día: colocar una tarea es soltarla en una casilla concreta de la rejilla, que es lo único que decide día y hora. Sin bandeja de entrada con nombre raro, sin catálogo aparte, sin siete campos de alta.
- **Banco de tareas.** Un catálogo permanente, desplegable desde la cabecera, con lo que se repite. Sacar una ficha NO la gasta: la misma se arrastra tantas veces como haga falta, que es lo que hace llevadero «leer de lunes a viernes». El banco **no guarda la última posición**: cada semana se coloca de nuevo.
- **Ninguna semana hereda nada.** Se descartó el traspaso automático que recreaba las tareas en su hueco anterior: era justo lo que el propietario no quería.
- **El banco se guarda en `taskTemplates`**, que ya existía y ya sincronizaba. Su columna `weekday` es `not null` en Postgres y aquí no significa nada: se escribe 1 y no se lee. Quitarla exigiría SQL a mano.
- **Duración al crear**, tanto en el banco como en las sueltas.
- **`day` y `startBlock` van juntos**: no hay día sin hora ni hora sin día. Una tarea con día pero sin hora no se vería en ningún sitio.
- **Anuncios del arrastre en español** (dnd-kit los trae en inglés hablando de «draggable items»).
- **El color dice de dónde salió cada tarea**: lima si vino del banco, naranja si es suelta. Con la cuadrícula llena, el color es lo que deja leerla de un vistazo.
- **Cuadrícula más legible**: filas de 42 px, bandas alternas por hora, cabeceras de día más grandes con su fecha, columna de hoy teñida de lima y raya magenta en la hora actual, que se mueve sola cada minuto.
- **Escala general subida** («hazlo más legible y grande», 2026-07-25): título a 30 px, semana a 20 px, cabeceras de día a 16 px, raíl horario a 14 px, texto de las tareas a 14 px en la rejilla y 18 px en las listas, raíl de horas más ancho y más aire entre secciones. La cuadrícula pasa a medir ~1500 px de alto: es scroll vertical, como cualquier calendario semanal.
- Fuera el contador «N pendientes» de la cabecera, a petición del propietario.
- **La duración es libre en minutos y no se redondea al bloque** (petición del propietario: «quiero poder poner tareas de 20 minutos»). Antes, 20 se guardaba bien pero se etiquetaba y se pintaba como 30, porque todo se cuantizaba a bloques de media hora. Ahora el bloque solo decide a qué HORA empieza una tarea; el alto del chip es proporcional a los minutos reales y los solapes se calculan en minutos. **La hora de inicio sigue en la media hora**: afinarla exigiría cambiar el `check (start_block between 0 and 47)` del esquema remoto, o sea, SQL a mano del propietario.

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
- (Fase 3) La animación `streak-fall` (el 0 cayendo) no se pudo ver en el navegador de verificación: reporta `prefers-reduced-motion: reduce` y la animación se desactiva a propósito, como las micro-animaciones de la Fase 1. Queda comprobada por CSS computado y pendiente de verse en el iPhone.
- (Fase 3) Los tooltips de las celdas del heatmap usan `title` + `aria-label` — en iOS no hay hover, así que al toque no se consultan. El color ya cuenta la historia; revisar en la Fase 5 solo si molesta.
- (Fase 3) Con umbral < 50 % algún tramo intermedio del heatmap quedaría sin uso; irrelevante porque el select de Ajustes limita a 50–100 %.
- (Fase 4) **Editar una tarea fija no toca las semanas futuras que ya se abrieron.** «Futura» significa «aún no abierta». Si se curioseó la semana que viene, se quedó con el texto viejo. Se arregla borrando esa tarea a mano, o se revisa si molesta.
- (Rediseño) `carriedOverCount` queda como columna muerta en el esquema local y remoto: vale siempre cero. Quitarla exigiría SQL a mano y no aporta nada.
- (Rediseño) La estética se ha verificado por estilos computados, no por captura: el panel del navegador no compone imagen en este entorno. El juicio visual final es del propietario.
- (Fase 4) Cada pulsación de la flecha derecha materializa esa semana: veinte pulsaciones son veinte semanas de tareas fijas creadas y sincronizadas. Sin tope, por ahora.
- (Fase 4) 252 celdas de soltado en escritorio (36 filas × 7 días). Solo se miden al empezar un arrastre (`MeasuringStrategy.WhileDragging`), así que no se ha notado. Vía de escape si algún día molesta: siete zonas de columna y calcular el bloque desde la posición del puntero — aritmética pura y testeable, pero más frágil.
- (Fase 4) El gesto táctil del arrastre sigue sin poderse simular (misma deuda que la Fase 1). Sí se han verificado con eventos de ratón reales los tres caminos: inbox → día, día → bloque y bloque → inbox. El gesto con el dedo lo prueba el propietario en el iPhone.
- (Fase 4) El navegador de verificación no ejecuta el envío nativo de formularios (ni el implícito con Enter, ni el del botón `submit`): los formularios se verificaron despachando el evento `submit`, que es el mismo camino que recorre React. En un navegador real funcionan sin más.
- (Fase 4) `GripIcon` está duplicado en `components/planner/DropZone.tsx` y en `components/habits/SortableHabitList.tsx`, `CheckToggle` vive en `components/habits/` aunque ya lo use el planificador, y `FIELD_CLASS` va por su tercera copia. §7 los querría en `components/ui/`, pero moverlos toca fases cerradas y §8 pide avisar antes (hallazgo del revisor de estética).

---

## Registro de sesiones

Una entrada por sesión: fecha, fase, qué se hizo, qué quedó pendiente.

### 2026-07-25 — Rediseño del planificador y pasada de estética (esta sesión)
- El propietario prueba la Fase 4 recién construida y pide cambiarla: la bandeja no le dice nada, las tareas fijas necesitan hora distinta por día, y la estética le parece fea y poco cuadrada. Se reescribe `CLAUDE.md` §4 y se extiende §6 antes de tocar código.
- **Modelo nuevo**: toda tarea nace en un día, tareas fijas agrupadas en fichas con varios días y su hora, tareas breves que se borran al cambiar de semana. Fuera la bandeja, el arrastre semanal, la alarma de las 3 semanas y el duplicado de semana.
- **Estética**: dos tipografías (la de máquina es la monoespaciada del sistema, sin descargar nada), esquinas casi rectas en toda la app, rótulos en versalitas y los chillones repartidos con un trabajo asignado a cada uno.
- 290 tests en verde tras rehacer los del planificador; verificado en navegador que una ficha «Gimnasio» con jueves 19:00 y sábado 11:00 genera sus dos tareas con horas distintas.
- Aclaración del propietario que cambia las prioridades: **monta las semanas en el PC**, no en el iPhone. Anotado en memoria; el criterio de aceptación del ROADMAP se queda desfasado y hay que reescribirlo.

### 2026-07-25 — Fase 4 construida
- **La Fase 4 empezaba con la mitad del trabajo hecho** y nadie lo recordaba: la Fase 1 ya había definido `PlannerTask` y `TaskTemplate` enteros y declarado sus tablas Dexie, y la Fase 2 ya había escrito sus codecs de sincronización, sus tablas remotas con RLS y su validación de respaldo. **No se ha tocado ni `sync.ts` ni el SQL**, así que la fase no ha generado ningún paso manual del propietario.
- Comprobado que la rama `fase-4` de la nota anterior nunca existió: se ha construido sobre `main`.
- **Calendario de semanas** en `logic/dates.ts`: `mondayOfWeekId` (ancla del 4 de enero, con comprobación de ida y vuelta para que un año sin W53 proteste), `addWeeksToWeekId`, `daysOfWeekId`, `dateOfWeekday`, `weeksBetweenWeekIds`, `formatWeekRangeEs`, `isoWeekdayOf` y los nombres de día. `IsoWeekday` se muda aquí. Solo añadidos: la Fase 3 queda intacta.
- **`logic/planner.ts` completo**: bloques de 30 min, generación desde plantillas con id determinista, plan de arrastre, duplicado de semana, carriles de solape, orden de presentación, nivel de alarma y zonas de soltado. Todo puro y con tests.
- **UI**: navegador de semana (sin tope hacia delante), inbox, siete carriles de día, cuadrícula de 00:00 a 24:00 con la madrugada plegada y su recuento, editor en línea a ancho completo, drag & drop con sensores separados, vista móvil de un día con selector que también recibe tareas soltadas, duplicar la semana anterior y pantalla de tareas fijas en subruta propia.
- **299 tests en verde** (120 nuevos), incluidos 24 de integración de `plannerTasksRepo` contra Dexie real sobre `fake-indexeddb`, que es donde vivía el riesgo de verdad.
- Verificado en navegador (375 y 1280) con datos sembrados: alta con Enter, completar, editar, navegar semanas, generación automática al abrir una semana futura, que borrar una tarea fija generada NO la resucita, arrastre semanal con su contador real, duplicado, solapes en carriles, madrugada plegada y los tres caminos del arrastre con eventos de ratón reales.
- **Revisores pasados, y no de adorno.** El de lógica encontró dos fallos graves reales que se han corregido: duplicar la semana el domingo dejaba cada tarea pendiente por duplicado el lunes (ahora se copian solo las completadas), y la materialización podía pisar por última escritura una edición hecha en el otro dispositivo (ahora espera a una bajada completa cuando hay sesión). Más: tope a la duración para no atascar la subida, tolerancia a un `weekId` corrupto que abortaba la preparación en silencio, y reintento si la preparación falla. El de estética encontró dos bloqueantes: no había forma cómoda de completar una tarea con hora (ahora el editor lleva su botón de 44 px) y en escritorio el texto de las columnas quedaba en tres caracteres (ahora la fila es compacta ahí y cómoda en móvil). Sus menores, aplicados.
- Pendiente para cerrar la fase: la prueba de aceptación del propietario.

### 2026-07-24/25 — Cierre de la Fase 2 · Fase 3 construida
- El propietario confirma completado su checklist de *Bloqueos* de la Fase 2 («mi parte está hecha»): Fase 2 → **Cerrada** sobre esa confirmación, sin re-verificación autenticada del agente (no maneja su contraseña). Push a `origin/main`.
- Decide además construir la **Fase 4 en paralelo** en otra sesión (worktree, rama `fase-4`, sin push); guía entregada. La fusión, después de que la Fase 3 llegue a `main`.
- **Fase 3 construida al completo.** Lógica pura con contratos diseñados por agente arquitecto: `logic/streaks.ts` (racha por hábito estricta, global por umbral con barrido de elegibles por `createdOn`, semanal tri-estado, récords recalculados, aviso `recentlyBroken` con ventana de días abiertos), `logic/stats.ts` (núcleo único de celdas que también alimenta el % semanal de la Fase 1 sin cambiar su firma, series semana/mes/año, heatmaps global y por hábito) y helpers nuevos de calendario en `logic/dates.ts`. **179 tests en verde** (81 nuevos) bajo TZ hostil.
- UI: pantalla de estadísticas completa (vista global y por hábito con estado local, `StreakHero` a `text-8xl`, aviso rojo de ruptura con animación de caída, gráficas Recharts con tokens vía `var(--color-*)`, heatmap anual CSS puro con scroll horizontal y selector de año, historial de notas de aprendizaje agrupado por mes), sección de umbral en Ajustes (monocroma, con «X de N» consistente con la comparación real) y `Stats` en `React.lazy` (Recharts fuera del bundle de arranque).
- Verificado en navegador (móvil 375 y escritorio) con historial sembrado en IndexedDB y `.env.local` de marcadores para no tocar la cuenta real (borrado al terminar): racha global 21 en lime con récord magenta, heatmap con niveles/congelados/futuro y auto-scroll, series con cruce de año, vista de Aprendizaje con notas, rotura de racha real (0 rojo + «Llevabas 35/19 días») por hábito y global, y el umbral 80→90 % repintando racha y heatmap en vivo.
- Revisores pasados: estética **0 infracciones**; rachas **sin hallazgos graves** — sus 4 hallazgos menores aplicados en el momento (filtro del numerador global contra registros anteriores al alta, selector de años del heatmap solo con activos, comentario honesto de `heatLevel`, `flex-wrap` en `StreakHero`) más 6 tests nuevos que pinnean esquinas (récord encogido por congelación retroactiva, alta dentro de rango congelado, serie semanal cruzando año…).
- Pendiente para cerrar la fase: la prueba de aceptación del propietario con su historial real.

### 2026-07-24 — Fase 2 (construcción completa)
- Plan de la fase diseñado con exploración previa y agente arquitecto; dos agujeros de convergencia detectados en el diseño y cerrados: trigger `lww_guard` en el servidor (un dispositivo rezagado no pisa filas más nuevas) y read-back tras cada push (el perdedor de la guardia se corrige a sí mismo).
- `supabase/schema.sql` y `policies.sql`: 6 tablas espejo con `updated_at` (ms del cliente), `deleted_at`, `synced_at` estampado por trigger, índices keyset y RLS por `user_id`. El propietario creó el proyecto, ejecutó el SQL y pegó las claves en el `.env` durante la propia sesión.
- Capa local: Dexie `version(2)` (outbox + syncMeta) cuya migración encola todo el historial de la Fase 1; repositorios y semilla encolan en la misma transacción de cada escritura; `settingsRepo` nuevo.
- `logic/sync.ts` y `logic/backup.ts` (funciones puras con 22 tests) y `data/sync.ts`: motor single-flight con coalescencia por snapshot, push por lotes con read-back, pull keyset paginado con cursor transaccional, siembra pospuesta, guardia de cambio de cuenta, debounce/online/visibilidad/backoff. 19 tests de integración sobre fake-indexeddb con un backend falso que modela la guardia del servidor. Suite total: 98 en verde; build limpio.
- UI: página de Ajustes real (login de usuario único sin registro, estado detallado con reintento, exportar/importar JSON con confirmación en línea de dos pasos), indicador monocromo (aside + insignia en la pestaña móvil), aviso de exportación a los 30 días en el registro diario. Revisor de estética pasado: color impecable; su bloqueante (componente hablando con supabase-js) y 3 menores corregidos en el momento.
- Verificado en navegador: modo sin claves («Solo local», siembra inmediata, export con estampado) y modo con claves sin sesión («Sin sesión», formulario). Pendiente: verificación autenticada (el propietario debe teclear su contraseña), limpieza de la cuenta, Vercel §4 y aceptación PC ↔ iPhone con la coreografía de adopción anotada en *Bloqueos*.
- Al final de la sesión, el propietario decide **aplazar el cierre de la Fase 2 y arrancar la Fase 3 en sesión nueva** sin esperar la verificación autenticada ni la aceptación. Fase 2 → *Bloqueada*; excepción a la regla del ROADMAP y riesgos anotados en *Bloqueos*. Los pasos aplazados quedan escritos ahí y en SETUP.md §4.

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
