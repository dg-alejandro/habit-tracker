# Rastreador de hábitos — proyecto personal

Aplicación web personal de seguimiento de hábitos y planificación semanal. **Un solo usuario**, usada desde PC y desde iPhone, con los datos sincronizados entre ambos.

Este archivo es la **fuente de verdad** del proyecto: qué se construye y con qué reglas.
- El **orden y el alcance de cada fase** están en `ROADMAP.md`.
- El **estado actual** está en `PROGRESO.md`. Léelo siempre al empezar y actualízalo siempre al terminar.
- Los **pasos manuales que dependen del propietario** están en `SETUP.md`.

Si algo no está especificado, elige la opción más simple, anótala en `PROGRESO.md` bajo *Decisiones tomadas* y sigue adelante. **No pares a preguntar** salvo que sea una acción manual mía (ver §8).

---

## 1. Cómo se usa la app

- **Cada noche.** Abro la app, marco lo que he cumplido hoy y cierro. Debe llevarme menos de un minuto.
- **Los domingos.** Abro el planificador y organizo la semana que empieza.
- **De vez en cuando.** Miro estadísticas y rachas.

Todo el diseño optimiza el primer caso. Lo demás es secundario.

---

## 2. Stack

| Pieza | Elección |
|---|---|
| Build | Vite |
| UI | React + TypeScript (modo estricto) |
| Estilos | Tailwind CSS |
| Base local | IndexedDB vía **Dexie** |
| Backend | **Supabase** (Postgres + Auth) |
| Gráficas | **Recharts** |
| Drag & drop | **@dnd-kit/core** |
| Fechas | **date-fns** |
| PWA | **vite-plugin-pwa** |
| Push (fase 5, opcional) | **web-push** + cron de Vercel |
| Tests | **Vitest** |
| Hosting | **Vercel** (plan Hobby) |

Heatmap anual y animaciones con CSS puro: no añadas librerías para eso.
**No introduzcas ninguna otra dependencia sin justificarlo en `PROGRESO.md`.**

### Arquitectura: local-first

1. Toda escritura va **primero a IndexedDB**. La UI responde al instante y nunca espera a la red.
2. Un proceso en segundo plano sincroniza con Supabase.
3. Sin conexión la app funciona con normalidad; al recuperarla, sincroniza.
4. Conflictos: **gana la escritura más reciente** (cada fila lleva `updated_at`).
5. Indicador discreto de estado: sincronizado / pendiente / error.

### Reglas de código

- La carpeta `src/logic/` contiene **funciones puras**: sin React, sin acceso a base de datos, sin `Date.now()` sin inyectar. Todo lo que sea cálculo de rachas, fechas o estadísticas vive ahí y es testeable de forma aislada.
- Los componentes **nunca** hablan con Dexie ni con Supabase directamente. Solo a través de `src/data/repositories/` y de hooks.
- **Código e identificadores en inglés. Textos de interfaz, comentarios y documentación en español.**
- TypeScript estricto. Nada de `any`.

---

## 3. Reglas de negocio — hábitos

Léelas enteras antes de escribir la lógica de rachas. Es la parte con más trampas del proyecto.

- **El día cierra a las 4:00.** Marcar a la 1:00 de la madrugada cuenta como el día anterior.
- **Zona horaria:** Europe/Madrid. **Semana:** de lunes a domingo (semana ISO).
- **Un día sin registrar cuenta como fallo** y rompe la racha. O está marcado, o falló.
- **Se pueden rellenar días pasados** navegando hacia atrás, sin límite de antigüedad.
- **Días congelados:** se puede congelar un rango de fechas (vacaciones, enfermedad), por adelantado o retroactivamente. Un día congelado **ni suma ni rompe**: se salta en las rachas y se excluye de los porcentajes.
- **Racha por hábito: estricta.** Un fallo la rompe y vuelve a cero.
- **Racha global: por umbral.** Un día cuenta si se cumple el **80 %** de los hábitos activos (configurable en ajustes). La racha global son los días consecutivos que superan el umbral.
- **Racha semanal:** semanas consecutivas cumpliendo el objetivo semanal mínimo del hábito (por defecto **5 de 7 días**, configurable por hábito).
- **Récords:** se guardan por hábito y global, y no se pierden nunca aunque la racha actual se rompa.
- **Hábitos nuevos:** su historial empieza el día que se crean. No se rellenan hacia atrás.
- **Archivar** saca el hábito de la vista diaria pero conserva historial y estadísticas.

### Tipos de hábito

Al crear un hábito se elige el tipo:

1. **Casilla** — sí/no.
2. **Contador con objetivo** — objetivo en minutos, acumulable en varias sesiones del mismo día (10 + 20 = 30). Se marca cumplido automáticamente al alcanzar el objetivo. Botones rápidos para sumar cantidades frecuentes.
3. **Contador con nota** — igual que el anterior, más un campo de texto libre para anotar el contenido del día. La nota se guarda en el historial y debe poder consultarse después.

### Hábitos precargados (14)

| Hábito | Tipo | Objetivo |
|---|---|---|
| Leer | Contador | 30 min |
| Aprendizaje | Contador con nota | 30 min — la nota es el tema (ventas, liderazgo…) |
| Gimnasio | Casilla | — |
| Beber 3 L de agua | Casilla | — |
| Comer sano | Casilla | — |
| Acostarse antes de las 00:30 | Casilla | — |
| Meditar 10 min | Casilla | — |
| Movilidad 20 min | Casilla | — |
| Limpiar 30 min | Casilla | — |
| Tomar suplementación | Casilla | — |
| Sin móvil la primera hora | Casilla | — |
| Planificar el día siguiente | Casilla | — |
| No fumar | Casilla | — |
| No gastar en tonterías | Casilla | — |

Con el umbral del 80 %, un día cuenta con **12 de 14** cumplidos.

---

## 4. Reglas de negocio — planificador

El planificador es **independiente de los hábitos**: no los muestra ni interactúa con ellos.

### Modelo de tarea

| Campo | Descripción |
|---|---|
| `text` | Título. Obligatorio. |
| `estimatedMinutes` | Duración estimada. Opcional. Determina cuántos bloques ocupa al colocarla. |
| `weekId` | Semana ISO a la que pertenece (`2026-W31`). |
| `day` | Día de la semana, o `null` si está en el inbox. |
| `startBlock` | Bloque horario de inicio, o `null` si no tiene hora asignada. |
| `done` | Completada o no. |
| `templateId` | Referencia a la plantilla que la generó, o `null` si es ocasional. |
| `carriedOverCount` | Número de semanas que lleva arrastrándose. |

### Tareas fijas (plantillas)

Existe un catálogo de **plantillas de tarea recurrente**: texto, día de la semana, hora opcional y duración opcional.

- Al crear una semana nueva, las plantillas **generan sus tareas automáticamente**.
- Editar o borrar la tarea generada en una semana concreta **no afecta a la plantilla**.
- Editar la plantilla afecta solo a las semanas futuras.
- Las plantillas se gestionan desde una pantalla propia dentro del planificador.

### Tareas ocasionales

Se crean directamente sobre un día o sobre el inbox. No tienen plantilla.

### Inbox semanal

Zona en la parte superior del planificador con las tareas de la semana **sin día asignado**. Es donde se vuelcan las ideas antes de colocarlas. Se arrastra desde el inbox a un día, y de un día a un bloque horario.

### Creación y edición

- **Creación rápida:** campo de texto en el inbox y en cada día. Escribir y Enter. Sin modales ni formularios.
- **Editar:** al tocar la tarea se abre en línea para cambiar texto, duración, día, hora o borrarla.
- **Completar:** casilla durante la semana. La tarea hecha se queda visible, tachada y atenuada.

### Arrastre semanal

Al pasar a una semana nueva, las tareas **no completadas** pasan automáticamente al **inbox** de la semana siguiente, con `carriedOverCount` incrementado en uno. A partir de la **tercera** semana arrastrada, la tarea se marca en rojo: o se hace, o se borra.

Las tareas generadas por plantilla **no se arrastran**: si no se hicieron, desaparecen y se regeneran la semana siguiente.

### Cuadrícula horaria

- Cobertura **00:00 a 24:00**, en bloques de **30 minutos**.
- Por defecto la franja **00:00–06:00 aparece plegada**, con un botón para desplegarla.
- Una tarea con duración estimada ocupa los bloques proporcionales al colocarla.
- **Duplicar la semana anterior:** copia las tareas sin su estado de completado.
- En móvil: un día visible cada vez, scroll vertical, navegación entre días.

---

## 5. Secciones de la app

### 5.1 Registro diario — pantalla de inicio
- Arriba del todo y **en color chillón**: el **porcentaje de cumplimiento de la semana en curso**. Es el dato más importante de la app.
- Debajo, la fecha registrada, con flechas para navegar a días anteriores.
- Lista de hábitos activos con **checkboxes grandes**, cómodos con el pulgar.
- Los contadores muestran progreso (18/30 min) y botones rápidos para sumar.
- **Micro-animación al marcar.** Debe dar gusto pulsar.
- Acceso rápido a congelar el día actual.

### 5.2 Gestión de hábitos
Añadir, editar, reordenar (drag & drop) y archivar. Al crear: nombre, tipo, objetivo si aplica, objetivo semanal mínimo. Ver y desarchivar archivados. Gestión de rangos de días congelados.

### 5.3 Rachas y estadísticas
- **Racha global** en enorme y en color chillón, arriba. Al lado, el récord.
- Racha actual, récord y racha semanal **por hábito**.
- Gráficas de evolución por **semana, mes y año**.
- **Heatmap anual tipo GitHub** con la escala en tonos chillones.
- Dos vistas: **global** y **por hábito**.
- Historial de las notas del hábito de aprendizaje, para ver qué se ha estudiado durante el año.

### 5.4 Planificador semanal
Según §4. Incluye pantalla de gestión de plantillas.

### 5.5 Ajustes y datos
- **Exportar e importar todo en JSON.** Único respaldo existente (ver §9).
- Aviso discreto en la pantalla principal si han pasado **más de 30 días** desde la última exportación. No modal, no intrusivo.
- Umbral de la racha global, hora de la notificación, cerrar sesión.

---

## 6. Diseño

**Base: blanco y negro, minimalista, tipo Notion.** Mucho espacio en blanco, tipografía limpia, bordes sutiles, cero adornos, cero sombras decorativas. Registro diario, gestión de hábitos y planificador son estrictamente monocromos.

**Excepción deliberada:** las **rachas y todos los datos estadísticos** van en colores chillones y saturados — naranja, verde ácido, magenta. Deben destacar violentamente sobre el fondo neutro. Son el único color de la app, y por eso funcionan.

- Números de racha **enormes**, desproporcionados a propósito.
- **Al romper una racha: que duela.** Rojo, aviso claro, el número cayendo a cero de forma visible. No lo suavices ni lo escondas: es el mecanismo que hace funcionar la app.
- Mobile-first: se diseña para el iPhone y se adapta al escritorio, no al revés.
- Objetivos táctiles grandes. Se usa de noche, con una mano, medio dormido.
- Interfaz **en español**.

Los tokens de color viven en `src/styles/tokens.css`. Ningún componente escribe un color a mano.

---

## 7. Estructura de carpetas

Respétala. Si necesitas crear una carpeta nueva, anótalo en `PROGRESO.md`.

```
/
├── .claude/settings.json      Permisos de Claude Code
├── CLAUDE.md                  Este archivo — qué se construye
├── ROADMAP.md                 Fases y criterios de aceptación
├── PROGRESO.md                Estado actual — se actualiza cada sesión
├── SETUP.md                   Pasos manuales del propietario
├── README.md                  Instalación y despliegue
├── .env.example
├── supabase/
│   ├── schema.sql             Tablas
│   └── policies.sql           RLS
├── public/                    Iconos, manifest
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── routes.tsx
    ├── pages/                 Una por sección
    │   ├── DailyLog.tsx
    │   ├── Habits.tsx
    │   ├── Stats.tsx
    │   ├── Planner.tsx
    │   └── Settings.tsx
    ├── components/
    │   ├── ui/                Primitivas reutilizables
    │   ├── habits/
    │   ├── stats/
    │   └── planner/
    ├── data/
    │   ├── types.ts           Tipos compartidos
    │   ├── db.ts              Esquema Dexie
    │   ├── supabase.ts        Cliente
    │   ├── sync.ts            Capa de sincronización
    │   └── repositories/      Acceso a datos por entidad
    ├── logic/                 Funciones puras, sin React ni I/O
    │   ├── streaks.ts
    │   ├── dates.ts
    │   ├── stats.ts
    │   └── planner.ts
    ├── hooks/
    └── styles/tokens.css
```

Tests junto al archivo que prueban: `logic/streaks.test.ts`.

---

## 8. Cómo trabajamos

- **Una instancia de Claude Code = una fase.** No empieces una fase nueva en una sesión que ya ha completado otra.
- **Al empezar:** lee `CLAUDE.md`, `ROADMAP.md` y `PROGRESO.md`. Confirma en qué fase estamos.
- **Modo plan.** Presenta el plan de la fase completa antes de tocar nada. Cuando lo apruebe, ejecuta la fase entera sin pararte a preguntar.
- **Al terminar:** actualiza `PROGRESO.md`, haz commit y dime **exactamente qué probar** para dar la fase por buena.
- Commits pequeños y descriptivos, en español.
- No refactorices fases ya cerradas sin avisar.
- Ante una ambigüedad: lo simple, anotado, y adelante.

### Lo único que depende de mí

Estas cosas **no las puedes hacer tú**. Cuando llegues a una, **para, dime los pasos exactos y espera**. Están detalladas en `SETUP.md`:

1. Crear el repositorio en GitHub (debe ser de mi cuenta personal, no de una organización).
2. Crear el proyecto en Supabase y darme las claves para el `.env`.
3. Ejecutar el SQL en el editor de Supabase.
4. Conectar el repositorio a Vercel y pegar las variables de entorno.
5. Instalar la PWA en el iPhone.
6. Generar las claves VAPID, si llegamos a la notificación.

Todo lo demás —instalar dependencias, escribir código, ejecutar tests, build, commits— lo haces tú sin preguntar.

---

## 9. Riesgos conocidos

- **El plan gratuito de Supabase no hace copias de seguridad automáticas.** El export a JSON no es un extra: es el único seguro que existe. Trátalo como funcionalidad crítica.
- **Supabase pausa los proyectos tras una semana sin actividad.** Con uso diario no ocurrirá; tras unas vacaciones largas hay que reactivarlo a mano. No se pierden datos.
- **El plan gratuito permite 2 proyectos.** Este ocupa el segundo.
- **Vercel Hobby no admite repositorios de una organización de GitHub.** El repo debe estar en la cuenta personal.
- **Vercel Hobby da 100 minutos de build al mes**, compartidos con los demás proyectos de la cuenta.
- **El push en iOS es frágil por naturaleza.** Por eso va al final y es opcional.
- **La sincronización offline es la mayor fuente de errores del proyecto.** Fase aislada, sin prisa, con tests.
