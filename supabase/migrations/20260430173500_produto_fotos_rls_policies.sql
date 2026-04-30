-- RLS para galeria de fotos dos produtos.
-- Leitura pública no catálogo; mutações permitidas somente para admin autenticado.

alter table public.produto_fotos enable row level security;

drop policy if exists "produto_fotos_select_public" on public.produto_fotos;
drop policy if exists "produto_fotos_insert_admin" on public.produto_fotos;
drop policy if exists "produto_fotos_update_admin" on public.produto_fotos;
drop policy if exists "produto_fotos_delete_admin" on public.produto_fotos;

create policy "produto_fotos_select_public"
  on public.produto_fotos for select
  to anon, authenticated
  using (true);

create policy "produto_fotos_insert_admin"
  on public.produto_fotos for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles pr
      where pr.id = (select auth.uid())
        and pr.role = 'admin'
    )
  );

create policy "produto_fotos_update_admin"
  on public.produto_fotos for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles pr
      where pr.id = (select auth.uid())
        and pr.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles pr
      where pr.id = (select auth.uid())
        and pr.role = 'admin'
    )
  );

create policy "produto_fotos_delete_admin"
  on public.produto_fotos for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles pr
      where pr.id = (select auth.uid())
        and pr.role = 'admin'
    )
  );
