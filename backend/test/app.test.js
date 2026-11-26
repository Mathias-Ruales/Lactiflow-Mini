import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { DatabaseError } from '../src/supabase-repository.js';

const PRODUCT = '11111111-1111-4111-8111-111111111111';
const ORDER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const validOrder = () => ({ customerName: 'Cliente de prueba', items: [{ productId: PRODUCT, quantity: 2 }] });

async function fixture(t, overrides = {}) {
  const stored = new Map();
  let writes = 0;
  const repository = {
    ready: async () => [],
    listProducts: async () => [{ id: PRODUCT, name: 'Leche de prueba', unit: '1 L' }],
    listOrders: async ({ limit, offset }) => [...stored.values()].slice(offset, offset + limit),
    async createOrder(order) {
      writes++;
      const result = { id: ORDER, customer_name: order.customerName, status: 'registrado',
        order_items: order.items.map((item) => ({ ...item, product_name: 'Leche de prueba' })) };
      stored.set(ORDER, result);
      return result;
    },
    getOrder: async (id) => stored.get(id),
    ...overrides,
  };
  const server = createApp({ repository });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = (body, extra = {}) => fetch(`${url}/api/orders`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body),
  });
  return { url, post, stored, writes: () => writes };
}

test('health and readiness distinguish running API from database access', async (t) => {
  const f = await fixture(t, { ready: async () => { throw new DatabaseError('offline'); } });
  assert.equal((await fetch(`${f.url}/health`)).status, 200);
  assert.equal((await fetch(`${f.url}/health/ready`)).status, 503);
});

test('catalog identifies its test products', async (t) => {
  const f = await fixture(t);
  const response = await fetch(`${f.url}/api/products`);
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.catalog, 'test-products');
  assert.equal(result.products[0].id, PRODUCT);
});

test('history is paginated and reports whether more records exist', async (t) => {
  let received;
  const records = Array.from({ length: 11 }, (_, i) => ({ id: `saved-${i}` }));
  const f = await fixture(t, { listOrders: async (input) => { received = input; return records; } });
  const response = await fetch(`${f.url}/api/orders?limit=10&offset=20`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(received, { limit: 11, offset: 20 });
  assert.equal(body.orders.length, 10);
  assert.equal(body.hasMore, true);
  assert.equal(body.offset, 20);
});

test('history rejects invalid pagination without querying the database', async (t) => {
  let calls = 0;
  const f = await fixture(t, { listOrders: async () => { calls++; return []; } });
  for (const query of ['limit=0', 'limit=51', 'limit=1.5', 'offset=-1', 'offset=100001', 'offset=abc']) {
    assert.equal((await fetch(`${f.url}/api/orders?${query}`)).status, 400);
  }
  assert.equal(calls, 0);
});

test('empty history is distinct from a database failure', async (t) => {
  const f = await fixture(t);
  const response = await fetch(`${f.url}/api/orders`);
  assert.deepEqual(await response.json(), { orders: [], hasMore: false, limit: 10, offset: 0 });
  const broken = await fixture(t, { listOrders: async () => { throw new DatabaseError('private'); } });
  assert.equal((await fetch(`${broken.url}/api/orders`)).status, 503);
});

test('valid order can be created and retrieved; client cannot select its status', async (t) => {
  const f = await fixture(t);
  const response = await f.post({ ...validOrder(), customerName: '  Cliente de prueba  ', status: 'enviado',
    items: [{ productId: PRODUCT, quantity: 2, product_name: 'Falso', price: 0 }] });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('location'), `/api/orders/${ORDER}`);
  const { order } = await response.json();
  assert.equal(order.customer_name, 'Cliente de prueba');
  assert.equal(order.status, 'registrado');
  assert.equal(order.order_items[0].product_name, 'Leche de prueba');
  assert.equal(order.order_items[0].quantity, 2);
  const read = await fetch(`${f.url}/api/orders/${order.id}`);
  assert.equal(read.status, 200);
  assert.deepEqual((await read.json()).order, order);
});

test('invalid input is rejected before any database write', async (t) => {
  const f = await fixture(t);
  const invalid = [null, [], {}, { ...validOrder(), customerName: ' ' },
    { ...validOrder(), items: [] }, { ...validOrder(), items: [{ productId: 'not-uuid', quantity: 1 }] },
    ...[0, -1, 1.5, '2', true, 1001].map((quantity) => ({ ...validOrder(), items: [{ productId: PRODUCT, quantity }] })),
    { ...validOrder(), items: [...validOrder().items, ...validOrder().items] },
    { ...validOrder(), items: Array.from({ length: 51 }, () => validOrder().items[0]) },
  ];
  for (const payload of invalid) assert.equal((await f.post(payload)).status, 400);
  assert.equal(f.writes(), 0);
  assert.equal(f.stored.size, 0);
});

test('unavailable product has a useful error without leaking the provider response', async (t) => {
  const f = await fixture(t, { createOrder: async () => { throw new DatabaseError('secret SQL', { productUnavailable: true }); } });
  const response = await f.post(validOrder());
  assert.equal(response.status, 422);
  assert.doesNotMatch(await response.text(), /secret SQL/);
  assert.equal(f.stored.size, 0);
});

test('database failure cannot masquerade as a successful order', async (t) => {
  const f = await fixture(t, { createOrder: async () => { throw new Error('sb_secret_PRIVATE'); } });
  const response = await f.post(validOrder());
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /sb_secret_PRIVATE/);
  assert.equal(f.stored.size, 0);
});

test('malformed JSON and wrong content type are rejected', async (t) => {
  const f = await fixture(t);
  const invalidJson = await fetch(`${f.url}/api/orders`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  });
  assert.equal(invalidJson.status, 400);
  const form = await fetch(`${f.url}/api/orders`, { method: 'POST', body: 'customerName=Test' });
  assert.equal(form.status, 415);
  assert.equal(f.writes(), 0);
});

test('oversized order is rejected without storing a record', async (t) => {
  const f = await fixture(t);
  const response = await f.post({ ...validOrder(), padding: 'x'.repeat(34_000) });
  assert.equal(response.status, 413);
  assert.equal(f.writes(), 0);
});

test('only configured browser origins get access, including preflight', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.post(validOrder(), { Origin: 'https://unrelated.example' })).status, 403);
  assert.equal(f.writes(), 0);
  const preflight = await fetch(`${f.url}/api/orders`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:5173');
});

test('invalid, missing, and unknown routes are handled explicitly', async (t) => {
  const f = await fixture(t);
  assert.equal((await fetch(`${f.url}/api/orders/not-an-id`)).status, 400);
  assert.equal((await fetch(`${f.url}/api/orders/${ORDER}`)).status, 404);
  assert.equal((await fetch(`${f.url}/missing`)).status, 404);
});
