create table if not exists public.study_states (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.set_study_states_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists study_states_updated_at on public.study_states;

create trigger study_states_updated_at
before update on public.study_states
for each row
execute function public.set_study_states_updated_at();

alter table public.study_states enable row level security;

