-- Permite marcar produtos como compatíveis com todos os modelos
-- (inclusive modelos cadastrados no futuro).
alter table public.produtos
  add column if not exists compat_todos_modelos boolean not null default false;

create index if not exists produtos_compat_todos_modelos_idx
  on public.produtos (compat_todos_modelos);

comment on column public.produtos.compat_todos_modelos is
  'Quando true, o produto aparece em qualquer filtro de veículo (modelo/marca/ano), sem depender de linhas em produto_compatibilidades.';
