-- Productos ficticios para Sprint 1. No son el catálogo del Lactiflow principal.
insert into public.products (id, sku, name, unit) values
  ('11111111-1111-4111-8111-111111111111', 'DEMO-LECHE', 'Leche entera de prueba', 'botella de 1 L'),
  ('22222222-2222-4222-8222-222222222222', 'DEMO-YOGUR', 'Yogur natural de prueba', 'envase de 500 ml'),
  ('33333333-3333-4333-8333-333333333333', 'DEMO-QUESO', 'Queso fresco de prueba', 'unidad de 500 g')
on conflict (id) do nothing;
