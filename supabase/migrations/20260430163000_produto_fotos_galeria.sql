-- Galeria de fotos por produto (fase de transição mantendo public.produtos.foto).
-- Objetivo: permitir múltiplas fotos por produto com 1 foto principal.

create table if not exists public.produto_fotos (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos (id) on delete cascade,
  foto text not null,
  ordem int not null default 0,
  is_principal boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists produto_fotos_produto_id_ordem_idx
  on public.produto_fotos (produto_id, ordem);

create unique index if not exists produto_fotos_unique_principal_por_produto_idx
  on public.produto_fotos (produto_id)
  where is_principal;

comment on table public.produto_fotos is
  'Fotos da galeria dos produtos; permite múltiplas fotos e somente 1 principal por produto.';

-- Backfill legado: migra public.produtos.foto para foto principal inicial.
insert into public.produto_fotos (produto_id, foto, ordem, is_principal)
select p.id, p.foto, 0, true
from public.produtos p
where p.foto is not null
  and btrim(p.foto) <> ''
  and not exists (
    select 1
    from public.produto_fotos pf
    where pf.produto_id = p.id
      and pf.is_principal
  );
