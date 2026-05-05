-- Cupons de desconto (admin) + aplicação no checkout (RPC criar_pedido_checkout).

create type public.cupom_tipo_desconto as enum ('percent', 'fixed');

create table public.cupons (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  tipo public.cupom_tipo_desconto not null,
  valor numeric(12, 2) not null,
  ativo boolean not null default true,
  valido_de timestamptz not null default now(),
  valido_ate timestamptz,
  max_usos int,
  usos_count int not null default 0 check (usos_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cupons_codigo_upper_unique unique (codigo),
  constraint cupons_percent_range check (
    tipo <> 'percent'::public.cupom_tipo_desconto
    or (valor > 0 and valor <= 100)
  ),
  constraint cupons_fixed_positive check (
    tipo <> 'fixed'::public.cupom_tipo_desconto or valor > 0
  ),
  constraint cupons_max_usos_ok check (max_usos is null or max_usos > 0)
);

comment on table public.cupons is 'Cupons cadastrados no admin; uso contabilizado ao criar pedido (checkout).';

create index cupons_ativo_idx on public.cupons (ativo);

create trigger cupons_set_updated_at
  before update on public.cupons
  for each row
  execute function public.set_pedidos_updated_at();

alter table public.pedidos
  drop constraint if exists pedidos_total_coerente;

alter table public.pedidos
  add column if not exists cupom_id uuid references public.cupons (id) on delete set null;

alter table public.pedidos
  add column if not exists desconto_cupom numeric(12, 2) not null default 0;

alter table public.pedidos
  add constraint pedidos_desconto_cupom_nonneg check (desconto_cupom >= 0);

alter table public.pedidos
  add constraint pedidos_total_coerente check (total = subtotal + frete - desconto_cupom);

comment on column public.pedidos.cupom_id is 'Cupom aplicado no checkout (se houver).';
comment on column public.pedidos.desconto_cupom is 'Valor absoluto do desconto do cupom em BRL.';

alter table public.cupons enable row level security;

create policy "cupons_select_admin"
  on public.cupons for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles pr
      where pr.id = (select auth.uid())
        and pr.role = 'admin'
    )
  );

create policy "cupons_insert_admin"
  on public.cupons for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles pr
      where pr.id = (select auth.uid())
        and pr.role = 'admin'
    )
  );

create policy "cupons_update_admin"
  on public.cupons for update
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

create policy "cupons_delete_admin"
  on public.cupons for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles pr
      where pr.id = (select auth.uid())
        and pr.role = 'admin'
    )
  );

-- Calcula desconto para uma base (subtotal + frete). Usado no preview e na RPC de pedido.
create or replace function public.calcular_cupom_desconto(p_codigo text, p_base numeric)
returns jsonb
language plpgsql
security definer
set search_path = pg_temp, public
as $$
declare
  v_base numeric(12, 2);
  r public.cupons%rowtype;
  v_desc numeric(12, 2);
begin
  v_base := round(coalesce(p_base, 0), 2)::numeric(12, 2);
  if v_base <= 0 then
    return jsonb_build_object('ok', true, 'desconto', 0, 'cupom_id', null);
  end if;

  if p_codigo is null or length(trim(p_codigo)) = 0 then
    return jsonb_build_object('ok', true, 'desconto', 0, 'cupom_id', null);
  end if;

  select *
    into r
  from public.cupons c
  where upper(trim(c.codigo)) = upper(trim(p_codigo))
    and c.ativo = true;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'message', 'Cupom inválido ou indisponível.'
    );
  end if;

  if r.valido_de > now() then
    return jsonb_build_object('ok', false, 'message', 'Este cupom ainda não está válido.');
  end if;

  if r.valido_ate is not null and r.valido_ate < now() then
    return jsonb_build_object('ok', false, 'message', 'Este cupom está expirado.');
  end if;

  if r.max_usos is not null and r.usos_count >= r.max_usos then
    return jsonb_build_object('ok', false, 'message', 'Este cupom esgotou os usos disponíveis.');
  end if;

  if r.tipo = 'percent'::public.cupom_tipo_desconto then
    v_desc := round(v_base * least(r.valor, 100::numeric) / 100.0, 2)::numeric(12, 2);
  else
    v_desc := least(round(r.valor, 2)::numeric(12, 2), v_base);
  end if;

  if v_desc <= 0 then
    return jsonb_build_object('ok', false, 'message', 'O cupom não pode ser aplicado a este pedido.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'desconto', v_desc,
    'cupom_id', r.id
  );
end;
$$;

comment on function public.calcular_cupom_desconto(text, numeric) is
  'Retorna JSON com desconto do cupom para uma base monetária (subtotal+frete). Security definer; não expõe lista de cupons.';

revoke all on function public.calcular_cupom_desconto(text, numeric) from public;
grant execute on function public.calcular_cupom_desconto(text, numeric) to authenticated;

-- CREATE OR REPLACE não remove a assinatura antiga: garantir uma única sobrecarga.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'criar_pedido_checkout'
      and n.nspname = 'public'
  loop
    execute format('drop function if exists %s cascade', r.sig);
  end loop;
end $$;

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
  p_cupom_codigo text default null
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
  v_cupom_id uuid;
  v_total numeric(12, 2);
  v_forma text;
  v_retirada boolean;
  v_calc jsonb;
  r_item record;
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
    where p.quantidade_estoque < l.quantidade
  ) then
    raise exception 'Estoque insuficiente para um ou mais itens.';
  end if;

  v_base := round(v_subtotal + v_frete, 2)::numeric(12, 2);

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
    p.titulo,
    p.cod_produto
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
  'Cria pedido + itens: desconto PIX/cartão; cupom opcional; retirada na loja; documento do destinatário opcional.';

revoke all on function public.criar_pedido_checkout(
  jsonb,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text
) from public;

grant execute on function public.criar_pedido_checkout(
  jsonb,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text
) to authenticated, service_role;
