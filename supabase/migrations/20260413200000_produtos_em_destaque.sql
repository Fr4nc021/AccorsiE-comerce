-- Destaque na vitrine da home (marque no cadastro/edição do produto).
alter table public.produtos
  add column if not exists em_destaque boolean not null default false;

create index if not exists produtos_em_destaque_idx
  on public.produtos (em_destaque)
  where em_destaque = true;
