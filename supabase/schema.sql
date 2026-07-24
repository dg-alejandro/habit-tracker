-- Esquema remoto del rastreador de hábitos (Fase 2).
-- Espejo en snake_case de las tablas Dexie. Se ejecuta a mano en el SQL Editor (SETUP.md §3),
-- ANTES que policies.sql.
--
-- Convenciones:
--   * PK (user_id, id) — salvo entries, cuya PK es la clave lógica (user_id, habit_id, date).
--   * updated_at bigint = epoch ms DEL CLIENTE: resuelve conflictos (última escritura gana).
--   * synced_at = reloj DEL SERVIDOR (default + trigger): cursor de bajada, inmune al desfase
--     de relojes entre dispositivos.
--   * deleted_at bigint = borrado lógico remoto; el borrado local sigue siendo físico.
--   * Sin claves foráneas entre tablas: no acoplan el push por lotes; la app es la validación.

create table public.habits (
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id             text not null,
  name           text not null,
  type           text not null check (type in ('check', 'counter', 'counter_note')),
  target_minutes integer,
  weekly_target  integer not null,
  sort_order     integer not null, -- "order" es palabra reservada en SQL
  created_on     date not null,
  archived_at    bigint,
  updated_at     bigint not null,
  deleted_at     bigint,
  synced_at      timestamptz not null default now(),
  primary key (user_id, id)
);

-- entries: la clave remota ES la clave lógica. `id` es informativo (desempate de la
-- paginación keyset); NO es único: si dos dispositivos crean la misma celda sin conexión,
-- converge la celda y el id deja de importar.
create table public.entries (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id   text not null,
  date       date not null,
  id         text not null,
  done       boolean not null,
  minutes    integer,
  note       text,
  updated_at bigint not null,
  deleted_at bigint,
  synced_at  timestamptz not null default now(),
  primary key (user_id, habit_id, date)
);

create table public.frozen_ranges (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  start_date date not null,
  end_date   date not null,
  note       text,
  updated_at bigint not null,
  deleted_at bigint,
  synced_at  timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.planner_tasks (
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id                 text not null,
  text               text not null,
  estimated_minutes  integer,
  week_id            text not null,
  day                smallint check (day between 1 and 7),
  start_block        smallint check (start_block between 0 and 47),
  done               boolean not null,
  template_id        text,
  carried_over_count integer not null,
  updated_at         bigint not null,
  deleted_at         bigint,
  synced_at          timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.task_templates (
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id                text not null,
  text              text not null,
  weekday           smallint not null check (weekday between 1 and 7),
  start_block       smallint check (start_block between 0 and 47),
  estimated_minutes integer,
  updated_at        bigint not null,
  deleted_at        bigint,
  synced_at         timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.settings (
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id                text not null check (id = 'settings'), -- singleton por usuario
  global_threshold  double precision not null,
  notification_time text,
  last_export_at    bigint,
  updated_at        bigint not null,
  deleted_at        bigint,
  synced_at         timestamptz not null default now(),
  primary key (user_id, id)
);

-- Guardia de "última escritura gana" + cursor: descarta en silencio cualquier UPDATE con
-- updated_at más antiguo que el almacenado (el upsert de un dispositivo rezagado no pisa
-- una fila más nueva) y, si pasa, estampa synced_at con el reloj del servidor.
create or replace function public.lww_guard()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.updated_at < old.updated_at then
    return null; -- escritura más antigua: se descarta (última escritura gana)
  end if;
  new.synced_at := now();
  return new;
end;
$$;

create trigger habits_lww         before update on public.habits         for each row execute function public.lww_guard();
create trigger entries_lww        before update on public.entries        for each row execute function public.lww_guard();
create trigger frozen_ranges_lww  before update on public.frozen_ranges  for each row execute function public.lww_guard();
create trigger planner_tasks_lww  before update on public.planner_tasks  for each row execute function public.lww_guard();
create trigger task_templates_lww before update on public.task_templates for each row execute function public.lww_guard();
create trigger settings_lww       before update on public.settings       for each row execute function public.lww_guard();

-- Índices de la bajada: keyset por (user_id, synced_at, id).
create index habits_pull_idx         on public.habits         (user_id, synced_at, id);
create index entries_pull_idx        on public.entries        (user_id, synced_at, id);
create index frozen_ranges_pull_idx  on public.frozen_ranges  (user_id, synced_at, id);
create index planner_tasks_pull_idx  on public.planner_tasks  (user_id, synced_at, id);
create index task_templates_pull_idx on public.task_templates (user_id, synced_at, id);
create index settings_pull_idx       on public.settings       (user_id, synced_at, id);
