-- Anos de referência por modelo (catálogo auxiliar). A compatibilidade do produto continua em produto_compatibilidades (ano_inicio / ano_fim).

create table if not exists public.modelo_anos (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references public.modelos (id) on delete cascade,
  ano smallint not null,
  created_at timestamptz not null default now(),
  constraint modelo_anos_ano_range check (ano >= 1900 and ano <= 2100),
  constraint modelo_anos_modelo_ano_unique unique (modelo_id, ano)
);

create index if not exists modelo_anos_modelo_id_idx on public.modelo_anos (modelo_id);

alter table public.modelo_anos enable row level security;

-- Ajuste estas policies no Supabase se usar autenticação real; o app admin usa a anon key no servidor.
create policy "modelo_anos_select" on public.modelo_anos for select using (true);
create policy "modelo_anos_insert" on public.modelo_anos for insert with check (true);
create policy "modelo_anos_delete" on public.modelo_anos for delete using (true);
