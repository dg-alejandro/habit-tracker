-- Políticas RLS por `user_id`: cada usuario ve y toca exclusivamente sus filas.
-- Se ejecuta a mano en el SQL Editor (SETUP.md §3), DESPUÉS de schema.sql.
--
-- Sin política para `anon`: denegado por defecto. El `(select auth.uid())` envuelto
-- deja que Postgres cachee el valor por consulta (recomendación del linter de Supabase).

alter table public.habits         enable row level security;
alter table public.entries        enable row level security;
alter table public.frozen_ranges  enable row level security;
alter table public.planner_tasks  enable row level security;
alter table public.task_templates enable row level security;
alter table public.settings       enable row level security;

create policy "habits_own"         on public.habits         for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "entries_own"        on public.entries        for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "frozen_ranges_own"  on public.frozen_ranges  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "planner_tasks_own"  on public.planner_tasks  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "task_templates_own" on public.task_templates for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "settings_own"       on public.settings       for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
