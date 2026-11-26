-- Ejecutar solo en el proyecto Supabase NUEVO de Lactiflow Pedidos.
-- La función registra cabecera y detalles en una sola transacción.
begin;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null check (char_length(name) between 1 and 120),
  unit text not null,
  active boolean not null default true
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(btrim(customer_name)) between 2 and 120),
  status text not null default 'registrado' check (status = 'registrado'),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name text not null,
  unit text not null,
  quantity integer not null check (quantity between 1 and 1000),
  unique (order_id, product_id)
);

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- No se permite acceso directo desde la web. Solo el backend usa la secret key.
revoke all on public.products, public.orders, public.order_items from anon, authenticated;
revoke all on public.products, public.orders, public.order_items from service_role;
grant select on public.products to service_role;
grant select, insert on public.orders, public.order_items to service_role;

create or replace function public.create_order(p_customer_name text, p_items jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_product public.products%rowtype;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_seen uuid[] := array[]::uuid[];
begin
  if p_customer_name is null or char_length(btrim(p_customer_name)) not between 2 and 120 then
    raise exception 'INVALID_CUSTOMER';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'INVALID_ITEMS';
  end if;
  if jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'INVALID_ITEMS';
  end if;

  insert into public.orders (customer_name) values (btrim(p_customer_name)) returning * into v_order;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object' or
       (v_item ->> 'product_id') is null or
       jsonb_typeof(v_item -> 'quantity') is distinct from 'number' then
      raise exception 'INVALID_ITEM';
    end if;
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::numeric;
    if v_quantity < 1 or v_quantity > 1000 or v_quantity <> trunc(v_quantity) then
      raise exception 'INVALID_QUANTITY';
    end if;
    if v_product_id = any(v_seen) then raise exception 'DUPLICATE_PRODUCT'; end if;
    v_seen := array_append(v_seen, v_product_id);

    select * into v_product from public.products where id = v_product_id and active;
    if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    insert into public.order_items (order_id, product_id, product_name, unit, quantity)
      values (v_order.id, v_product.id, v_product.name, v_product.unit, v_quantity::integer);
  end loop;

  return jsonb_build_object(
    'id', v_order.id, 'customer_name', v_order.customer_name,
    'status', v_order.status, 'created_at', v_order.created_at,
    'order_items', (select jsonb_agg(jsonb_build_object(
      'product_id', i.product_id, 'product_name', i.product_name,
      'unit', i.unit, 'quantity', i.quantity
    ) order by i.id) from public.order_items i where i.order_id = v_order.id)
  );
end;
$$;

revoke all on function public.create_order(text, jsonb) from public, anon, authenticated;
grant execute on function public.create_order(text, jsonb) to service_role;
commit;
