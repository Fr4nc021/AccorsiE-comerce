-- Kits de produtos + desconto oficial no checkout

-- ---------------------------------------------------------------------------
-- kits
-- ---------------------------------------------------------------------------
create table if not exists public.kits (
  id uuid primary key default gen_random_uuid(),
  nome text,
  slug text,
  descricao text,
  imagem text,
  tipo_desconto text not null default 'percentual'
    check (tipo_desconto in ('percentual', 'valor_fixo', 'preco_fixo')),
  valor_desconto numeric(12, 2) not null default 0 check (valor_desconto >= 0),
  preco_final numeric(12, 2) check (preco_final is null or preco_final >= 0),
  seo_title text,
  seo_description text,
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists kits_slug_unique
  on public.kits (slug)
  where slug is not null and btrim(slug) <> '';

create index if not exists kits_status_idx on public.kits (status);

create or replace function public.set_kits_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_kits_updated_at on public.kits;
create trigger trg_kits_updated_at
  before update on public.kits
  for each row execute function public.set_kits_updated_at();

comment on table public.kits is 'Kits compostos por produtos existentes; desconto aplicado no checkout.';

-- ---------------------------------------------------------------------------
-- kit_items
-- ---------------------------------------------------------------------------
create table if not exists public.kit_items (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references public.kits (id) on delete cascade,
  product_id uuid not null references public.produtos (id) on delete cascade,
  quantidade int not null check (quantidade > 0),
  created_at timestamptz not null default now(),
  constraint kit_items_kit_product_unique unique (kit_id, product_id)
);

create index if not exists kit_items_kit_id_idx on public.kit_items (kit_id);
create index if not exists kit_items_product_id_idx on public.kit_items (product_id);

-- ---------------------------------------------------------------------------
-- pedidos: desconto_kit
-- ---------------------------------------------------------------------------
alter table public.pedidos
  add column if not exists desconto_kit numeric(12, 2) not null default 0;

alter table public.pedidos
  drop constraint if exists pedidos_desconto_kit_nonneg;

alter table public.pedidos
  add constraint pedidos_desconto_kit_nonneg check (desconto_kit >= 0);

alter table public.pedidos
  drop constraint if exists pedidos_total_coerente;

alter table public.pedidos
  add constraint pedidos_total_coerente
  check (total = subtotal + frete - desconto_cupom - desconto_kit);

alter table public.pedidos
  add column if not exists kits_snapshot jsonb;

comment on column public.pedidos.desconto_kit is 'Soma das economias dos kits aplicados no pedido (BRL).';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.kits enable row level security;
alter table public.kit_items enable row level security;

drop policy if exists "kits_select_public" on public.kits;
create policy "kits_select_public"
  on public.kits for select
  to anon, authenticated
  using (
    status = 'published'
    or exists (
      select 1 from public.profiles pr
      where pr.id = (select auth.uid()) and pr.role = 'admin'
    )
  );

drop policy if exists "kits_insert_admin" on public.kits;
create policy "kits_insert_admin"
  on public.kits for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles pr
      where pr.id = (select auth.uid()) and pr.role = 'admin'
    )
  );

drop policy if exists "kits_update_admin" on public.kits;
create policy "kits_update_admin"
  on public.kits for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles pr
      where pr.id = (select auth.uid()) and pr.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles pr
      where pr.id = (select auth.uid()) and pr.role = 'admin'
    )
  );

drop policy if exists "kits_delete_admin" on public.kits;
create policy "kits_delete_admin"
  on public.kits for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles pr
      where pr.id = (select auth.uid()) and pr.role = 'admin'
    )
  );

drop policy if exists "kit_items_select_public" on public.kit_items;
create policy "kit_items_select_public"
  on public.kit_items for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.kits k
      where k.id = kit_id
        and (
          k.status = 'published'
          or exists (
            select 1 from public.profiles pr
            where pr.id = (select auth.uid()) and pr.role = 'admin'
          )
        )
    )
  );

drop policy if exists "kit_items_insert_admin" on public.kit_items;
create policy "kit_items_insert_admin"
  on public.kit_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles pr
      where pr.id = (select auth.uid()) and pr.role = 'admin'
    )
  );

drop policy if exists "kit_items_update_admin" on public.kit_items;
create policy "kit_items_update_admin"
  on public.kit_items for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles pr
      where pr.id = (select auth.uid()) and pr.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles pr
      where pr.id = (select auth.uid()) and pr.role = 'admin'
    )
  );

drop policy if exists "kit_items_delete_admin" on public.kit_items;
create policy "kit_items_delete_admin"
  on public.kit_items for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles pr
      where pr.id = (select auth.uid()) and pr.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- Checkout RPC com p_kit_ids
-- ---------------------------------------------------------------------------
drop function if exists public.criar_pedido_checkout(
  jsonb, numeric, text, text, text, text, text, text, text, text, text, text, text, boolean, text
);

create or replace function public.criar_pedido_checkout(
  p_itens jsonb,
  p_frete numeric,
  p_destinatario_nome text,
  p_telefone text,
  p_cep text,
  p_logradouro text,
  p_numero text,
  p_complemento text,
  p_bairro text,
  p_cidade text,
  p_uf text,
  p_forma_pagamento text,
  p_destinatario_documento text default null,
  p_retirada_loja boolean default false,
  p_cupom_codigo text default null,
  p_kit_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = pg_temp, public
as $$
declare
  v_uid uuid;
  v_pedido_id uuid;
  v_subtotal numeric(12, 2);
  v_frete numeric(12, 2);
  v_base numeric(12, 2);
  v_desconto_cupom numeric(12, 2);
  v_desconto_kit numeric(12, 2);
  v_cupom_id uuid;
  v_total numeric(12, 2);
  v_forma text;
  v_retirada boolean;
  v_calc jsonb;
  r_item record;
  v_kit_id uuid;
  v_kit record;
  v_kit_normal numeric(12, 2);
  v_kit_preco numeric(12, 2);
  v_kit_economia numeric(12, 2);
  v_kits_snapshot jsonb := '[]'::jsonb;
  v_need int;
  v_avail int;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Sessão obrigatória para criar pedido.';
  end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Informe ao menos um item no pedido.';
  end if;

  v_retirada := coalesce(p_retirada_loja, false);
  if v_retirada then
    v_frete := 0;
  else
    v_frete := coalesce(p_frete, 0);
  end if;

  if v_frete < 0 then
    raise exception 'Frete inválido.';
  end if;

  v_forma := lower(btrim(coalesce(p_forma_pagamento, '')));
  if v_forma not in ('pix', 'cartao') then
    v_forma := 'cartao';
  end if;

  if nullif(btrim(p_destinatario_nome), '') is null
     or nullif(btrim(p_telefone), '') is null
     or nullif(btrim(p_cep), '') is null
     or nullif(btrim(p_logradouro), '') is null
     or nullif(btrim(p_numero), '') is null
     or nullif(btrim(p_bairro), '') is null
     or nullif(btrim(p_cidade), '') is null
     or nullif(btrim(p_uf), '') is null
  then
    raise exception 'Preencha todos os dados obrigatórios de entrega.';
  end if;

  create temporary table tmp_pedido_linhas (
    produto_id uuid not null primary key,
    quantidade int not null check (quantidade > 0)
  ) on commit drop;

  create temporary table tmp_kit_pool (
    produto_id uuid not null primary key,
    quantidade int not null check (quantidade >= 0)
  ) on commit drop;

  for r_item in
    select e.elem as el
    from jsonb_array_elements(p_itens) as e(elem)
  loop
    declare
      v_pid uuid;
      v_q int;
    begin
      if jsonb_typeof(r_item.el) <> 'object' then
        raise exception 'Formato inválido dos itens do pedido.';
      end if;
      v_pid := nullif(btrim(r_item.el->>'produto_id'), '')::uuid;
      if v_pid is null then
        raise exception 'Cada item deve ter produto_id válido.';
      end if;
      begin
        v_q := (r_item.el->>'quantidade')::int;
      exception
        when others then
          raise exception 'Quantidade inválida para o produto %.', v_pid;
      end;
      if v_q is null or v_q <= 0 then
        raise exception 'Quantidade deve ser maior que zero.';
      end if;

      insert into tmp_pedido_linhas (produto_id, quantidade)
      values (v_pid, v_q)
      on conflict (produto_id) do update
        set quantidade = tmp_pedido_linhas.quantidade + excluded.quantidade;
    end;
  end loop;

  insert into tmp_kit_pool (produto_id, quantidade)
  select produto_id, quantidade from tmp_pedido_linhas;

  perform 1
  from public.produtos p
  inner join tmp_pedido_linhas l on l.produto_id = p.id
  order by p.id
  for update;

  select round(coalesce(sum(
    round(
      p.valor::numeric * (1 - (
        case v_forma
          when 'pix' then least(coalesce(p.desconto_pix_percent, 0), 100) / 100.0
          else least(coalesce(p.desconto_cartao_percent, 0), 100) / 100.0
        end
      )),
      2
    ) * l.quantidade
  ), 0), 2)::numeric(12, 2)
    into v_subtotal
  from tmp_pedido_linhas l
  inner join public.produtos p on p.id = l.produto_id;

  if exists (
    select 1
    from tmp_pedido_linhas l
    left join public.produtos p on p.id = l.produto_id
    where p.id is null
  ) then
    raise exception 'Um ou mais produtos não foram encontrados.';
  end if;

  if exists (
    select 1
    from tmp_pedido_linhas l
    inner join public.produtos p on p.id = l.produto_id
    where coalesce(p.status, 'draft') is distinct from 'published'
  ) then
    raise exception 'Um ou mais produtos não estão disponíveis para compra.';
  end if;

  if exists (
    select 1
    from tmp_pedido_linhas l
    inner join public.produtos p on p.id = l.produto_id
    where p.valor is null
  ) then
    raise exception 'Um ou mais produtos estão com preço incompleto.';
  end if;

  if exists (
    select 1
    from tmp_pedido_linhas l
    inner join public.produtos p on p.id = l.produto_id
    where p.quantidade_estoque < l.quantidade
  ) then
    raise exception 'Estoque insuficiente para um ou mais itens.';
  end if;

  if exists (
    select 1
    from tmp_pedido_linhas l
    inner join public.produtos p on p.id = l.produto_id
    where coalesce(p.somente_retirada_loja, false) = true
  ) and not v_retirada then
    raise exception 'O pedido contém produtos disponíveis apenas para retirada na loja.';
  end if;

  -- Kits: validar composição e somar economia (sobre preço de catálogo)
  v_desconto_kit := 0;

  if p_kit_ids is not null then
    for v_kit_id in
      select distinct x from unnest(p_kit_ids) as u(x) where x is not null
    loop
      select k.* into v_kit
      from public.kits k
      where k.id = v_kit_id;

      if not found or coalesce(v_kit.status, 'draft') is distinct from 'published' then
        raise exception 'Um ou mais kits não estão disponíveis.';
      end if;

      if not exists (select 1 from public.kit_items ki where ki.kit_id = v_kit_id) then
        raise exception 'Kit % está sem itens.', coalesce(v_kit.nome, v_kit_id::text);
      end if;

      -- Verificar e alocar quantidades
      for r_item in
        select ki.product_id, ki.quantidade
        from public.kit_items ki
        where ki.kit_id = v_kit_id
      loop
        v_need := r_item.quantidade;
        select coalesce(quantidade, 0) into v_avail
        from tmp_kit_pool
        where produto_id = r_item.product_id;

        if coalesce(v_avail, 0) < v_need then
          raise exception 'Carrinho incompleto para o kit %.', coalesce(v_kit.nome, v_kit_id::text);
        end if;

        update tmp_kit_pool
          set quantidade = quantidade - v_need
        where produto_id = r_item.product_id;
      end loop;

      select round(coalesce(sum(p.valor::numeric * ki.quantidade), 0), 2)
        into v_kit_normal
      from public.kit_items ki
      inner join public.produtos p on p.id = ki.product_id
      where ki.kit_id = v_kit_id;

      if v_kit.tipo_desconto = 'preco_fixo' then
        v_kit_preco := round(coalesce(v_kit.preco_final, 0), 2);
      elsif v_kit.tipo_desconto = 'valor_fixo' then
        v_kit_preco := round(greatest(0, v_kit_normal - coalesce(v_kit.valor_desconto, 0)), 2);
      else
        -- percentual
        v_kit_preco := round(
          v_kit_normal * (1 - least(coalesce(v_kit.valor_desconto, 0), 100) / 100.0),
          2
        );
      end if;

      if v_kit_preco < 0 then
        v_kit_preco := 0;
      end if;

      v_kit_economia := round(greatest(0, v_kit_normal - v_kit_preco), 2);
      v_desconto_kit := round(v_desconto_kit + v_kit_economia, 2);

      v_kits_snapshot := v_kits_snapshot || jsonb_build_array(jsonb_build_object(
        'kit_id', v_kit_id,
        'nome', coalesce(v_kit.nome, ''),
        'desconto', v_kit_economia
      ));
    end loop;
  end if;

  if v_desconto_kit > v_subtotal then
    v_desconto_kit := v_subtotal;
  end if;

  v_base := round(v_subtotal + v_frete - v_desconto_kit, 2)::numeric(12, 2);
  if v_base < 0 then
    v_base := 0;
  end if;

  v_desconto_cupom := 0;
  v_cupom_id := null;

  if p_cupom_codigo is not null and length(trim(p_cupom_codigo)) > 0 then
    v_calc := public.calcular_cupom_desconto(p_cupom_codigo, v_base);
    if coalesce((v_calc->>'ok')::boolean, false) is distinct from true then
      raise exception '%', coalesce(v_calc->>'message', 'Cupom inválido.');
    end if;
    v_desconto_cupom := round(coalesce((v_calc->>'desconto')::numeric, 0), 2)::numeric(12, 2);
    if (v_calc ? 'cupom_id') and v_calc->>'cupom_id' is not null then
      v_cupom_id := (v_calc->>'cupom_id')::uuid;
    end if;
  end if;

  if v_desconto_cupom < 0 then
    v_desconto_cupom := 0;
  end if;

  if v_desconto_cupom > v_base then
    v_desconto_cupom := v_base;
  end if;

  v_total := round(v_base - v_desconto_cupom, 2)::numeric(12, 2);

  if v_total <= 0 then
    raise exception 'O valor final do pedido deve ser maior que zero.';
  end if;

  insert into public.pedidos (
    user_id,
    status,
    subtotal,
    frete,
    total,
    desconto_cupom,
    desconto_kit,
    kits_snapshot,
    cupom_id,
    destinatario_nome,
    telefone,
    cep,
    logradouro,
    numero,
    complemento,
    bairro,
    cidade,
    uf,
    retirada_loja,
    destinatario_documento
  )
  values (
    v_uid,
    'aguardando_pagamento',
    v_subtotal,
    v_frete,
    v_total,
    v_desconto_cupom,
    v_desconto_kit,
    case when jsonb_array_length(v_kits_snapshot) > 0 then v_kits_snapshot else null end,
    v_cupom_id,
    btrim(p_destinatario_nome),
    btrim(p_telefone),
    btrim(p_cep),
    btrim(p_logradouro),
    btrim(p_numero),
    nullif(btrim(p_complemento), ''),
    btrim(p_bairro),
    btrim(p_cidade),
    upper(btrim(p_uf)),
    v_retirada,
    nullif(btrim(p_destinatario_documento), '')
  )
  returning id into v_pedido_id;

  insert into public.pedido_itens (
    pedido_id,
    produto_id,
    quantidade,
    preco_unitario,
    titulo_snapshot,
    cod_produto_snapshot
  )
  select
    v_pedido_id,
    l.produto_id,
    l.quantidade,
    round(
      p.valor::numeric * (1 - (
        case v_forma
          when 'pix' then least(coalesce(p.desconto_pix_percent, 0), 100) / 100.0
          else least(coalesce(p.desconto_cartao_percent, 0), 100) / 100.0
        end
      )),
      2
    )::numeric(12, 2),
    coalesce(p.titulo, ''),
    coalesce(p.cod_produto, '')
  from tmp_pedido_linhas l
  inner join public.produtos p on p.id = l.produto_id;

  if v_cupom_id is not null then
    update public.cupons
      set usos_count = usos_count + 1
    where id = v_cupom_id;
  end if;

  return v_pedido_id;
end;
$$;

comment on function public.criar_pedido_checkout is
  'Cria pedido + itens; desconto PIX/cartão; kits (p_kit_ids); cupom; retirada; published only.';

revoke all on function public.criar_pedido_checkout(
  jsonb, numeric, text, text, text, text, text, text, text, text, text, text, text, boolean, text, uuid[]
) from public;

grant execute on function public.criar_pedido_checkout(
  jsonb, numeric, text, text, text, text, text, text, text, text, text, text, text, boolean, text, uuid[]
) to authenticated, service_role;
