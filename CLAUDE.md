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

## 4. Reglas de negocio - planificador

El planificador es **independiente de los habitos**: no los muestra ni interactua con ellos.

Tiene **tres piezas**: el **banco** de tareas reutilizables, la caja de **sueltas de esta semana**, y la **cuadricula** donde se coloca todo arrastrando.

**La regla que ordena todo: escribir y colocar son dos pasos distintos.** Nada nace con dia ni hora - **arrastrar a una casilla de la cuadricula es lo unico que decide cuando**. Los horarios varian y un jueves no se parece a un sabado.

### El banco de tareas

Un catalogo permanente de lo que se repite: gimnasio, leer, compra. Cada ficha es un **nombre y, si acaso, una duracion**. Se despliega desde la cabecera del planificador.

- **No pertenece a ninguna semana y no recuerda donde estuvo la tarea.** Cada semana se coloca de nuevo, donde toque.
- **Sacar una ficha no la gasta:** la misma se arrastra tantas veces como haga falta. «Leer» de lunes a viernes son cinco arrastres de la misma ficha.
- Quitar una ficha del banco **no toca** las tareas que ya se colocaron con ella: esas son lo que hiciste esa semana.

### Las tareas sueltas

Lo que solo importa esta semana. Se escriben en su caja, se arrastran a la cuadricula, y **si acaban la semana sin hacerse, se borran**. Lo COMPLETADO nunca se borra: es el historial.

**Ninguna semana hereda nada de la anterior.** Cada una empieza vacia y se llena tirando del banco.

### Modelo de tarea

| Campo | Descripcion |
|---|---|
| `text` | Titulo. Obligatorio. |
| `estimatedMinutes` | Duracion estimada. Opcional, y se puede poner al crearla. Determina cuantos bloques ocupa. |
| `weekId` | Semana ISO a la que pertenece (`2026-W31`). |
| `day` | Dia en el que esta colocada, o `null` si sigue sin colocar. |
| `startBlock` | Bloque horario, o `null` si sigue sin colocar. Van siempre juntos: no hay dia sin hora ni hora sin dia. |
| `done` | Completada o no. |
| `templateId` | Ficha del banco de la que salio, o `null` si es una tarea suelta. Es lo que la pinta distinta. |
| `carriedOverCount` | **En desuso.** Vale siempre cero; la columna sigue en el esquema remoto, que no se toca. |

El banco vive en la tabla `taskTemplates`. Su columna `weekday` es `not null` en Postgres y **aqui no significa nada**: se escribe 1 y no se lee. Quitarla exigiria ejecutar SQL a mano.

### Creacion y edicion

- **Dos campos de escritura y ninguno mas:** uno para anadir al banco, otro para las sueltas de la semana. Escribir y Enter.
- **Colocar es arrastrar:** del banco o de la caja a una casilla, entre casillas, o de vuelta a la caja para descolocar.
- **Editar:** al tocar la tarea se abre en linea para cambiar texto, dia, hora, duracion o borrarla. Las fichas del banco se editan tocandolas dentro del banco.
- **Completar:** casilla durante la semana. La tarea hecha se queda visible, tachada y atenuada.

### Cuadricula horaria

- Cobertura **00:00 a 24:00**, en bloques de **30 minutos**, con los siete dias en columnas y bandas alternas por hora para poder seguirla con la vista.
- Por defecto la franja **00:00-06:00 aparece plegada**, con el recuento de lo que esconde.
- **El color dice de donde salio cada tarea**: lima si vino del banco, naranja si es suelta. La columna de hoy va tenida de lima y una raya magenta marca la hora actual.
- Una tarea con duracion ocupa los bloques proporcionales. Solaparlas es legitimo: se reparten a media anchura.
- **Todo lo que hace el arrastre se puede hacer tambien desde los selectores del editor**, porque el gesto tactil no es verificable desde el entorno de desarrollo.
- En movil: un dia visible cada vez, con una tira para elegir cual.

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

**Base: negro y blanco —fondo negro—, minimalista, con aire de terminal.** Mucho espacio vacío, bordes sutiles, esquinas casi rectas, cero sombras decorativas. El grueso de cada pantalla sigue siendo monocromo. (Hasta el 2026-07-23 el fondo era blanco; se invirtió a petición del propietario: la app se usa de noche.)

**Dos tipografías** (2026-07-25, petición del propietario). El cuerpo va en la sans del sistema, para leer. Títulos, etiquetas de sección, horas, cifras y todo lo destacado van en **`font-display`**, que es la monoespaciada del sistema: de ahí sale el aire retro. No es un archivo descargado — cero bytes, cero dependencias y funciona sin red desde el primer día.

**El color señala, no adorna.** Los chillones —naranja, verde ácido, magenta— ya no viven solo en las estadísticas, pero cada uno tiene un trabajo y ninguno decora:

| Color | Significa |
|---|---|
| `streak-lime` | «Estás aquí» y «esto es estructura»: sección activa de la navegación, día de hoy, rótulos de sección, tareas fijas |
| `streak-orange` | Cifras que miden: el % semanal, los pendientes, las series |
| `streak-magenta` | Récords |
| `streak-red` | **Solo ruptura.** La racha rota, y los botones que borran de verdad |

Un color que no signifique nada de eso no entra. El fondo, el texto y los bordes siguen siendo neutros siempre: sobre negro, un filete de dos píxeles ya grita bastante.

Los tokens de color y de tipografía viven en `src/styles/tokens.css`. Ningún componente escribe un color ni una familia a mano.

- Números de racha **enormes**, desproporcionados a propósito.
- **Al romper una racha: que duela.** Rojo, aviso claro, el número cayendo a cero de forma visible. No lo suavices ni lo escondas: es el mecanismo que hace funcionar la app.
- Mobile-first: se diseña para el iPhone y se adapta al escritorio, no al revés.
- Objetivos táctiles grandes. Se usa de noche, con una mano, medio dormido.
- Interfaz **en español**.


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
