-- Categorias de produto e vínculo N:N (um produto pode ter várias categorias).

create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  constraint categorias_nome_unique unique (nome),
  constraint categorias_slug_unique unique (slug)
);

create index if not exists categorias_slug_idx on public.categorias (slug);

create table if not exists public.produto_categorias (
  produto_id uuid not null references public.produtos (id) on delete cascade,
  categoria_id uuid not null references public.categorias (id) on delete cascade,
  primary key (produto_id, categoria_id)
);

create index if not exists produto_categorias_categoria_id_idx on public.produto_categorias (categoria_id);

alter table public.categorias enable row level security;

create policy "categorias_select" on public.categorias for select using (true);
create policy "categorias_insert" on public.categorias for insert with check (true);
create policy "categorias_update" on public.categorias for update using (true);
create policy "categorias_delete" on public.categorias for delete using (true);

alter table public.produto_categorias enable row level security;

create policy "produto_categorias_select" on public.produto_categorias for select using (true);
create policy "produto_categorias_insert" on public.produto_categorias for insert with check (true);
create policy "produto_categorias_delete" on public.produto_categorias for delete using (true);
