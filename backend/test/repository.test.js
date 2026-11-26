import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseRepository, DatabaseError, loadConfig } from '../src/supabase-repository.js';

const config = { url: 'https://pedidos-example.supabase.co', key: 'sb_secret_TEST_ONLY_NOT_A_REAL_KEY' };

test('missing and publishable database credentials fail with setup instructions', () => {
  assert.throws(() => loadConfig({}), /SUPABASE_URL/);
  assert.throws(() => loadConfig({ SUPABASE_URL: config.url, SUPABASE_SECRET_KEY: 'sb_publishable_fake' }), /SUPABASE_SECRET_KEY/);
  assert.throws(() => loadConfig({ SUPABASE_URL: 'http://unsafe.example', SUPABASE_SECRET_KEY: config.key }), /HTTPS/);
  assert.equal(loadConfig({ SUPABASE_URL: config.url, SUPABASE_SECRET_KEY: config.key }).port, 3001);
});

test('orders use a single RPC for atomic insertion, not separate REST inserts', async () => {
  const calls = [];
  const repository = createSupabaseRepository(config, async (url, options) => {
    calls.push({ url, options });
    return Response.json({ id: 'saved', status: 'registrado' });
  });
  const input = { customerName: 'Test', items: [{ product_id: 'sample', quantity: 2 }] };
  assert.equal((await repository.createOrder(input)).id, 'saved');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${config.url}/rest/v1/rpc/create_order`);
  assert.equal(calls[0].options.headers.apikey, config.key);
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(calls[0].options.body), { p_customer_name: 'Test', p_items: input.items });
});

test('Supabase product failure is classified without passing private details to the API', async () => {
  const repository = createSupabaseRepository(config, async () => Response.json(
    { code: 'P0001', message: 'PRODUCT_UNAVAILABLE', details: 'private' }, { status: 400 },
  ));
  await assert.rejects(repository.createOrder({ customerName: 'Test', items: [] }), (error) =>
    error instanceof DatabaseError && error.productUnavailable && !error.message.includes('private'));
});

test('network failures become database errors', async () => {
  const repository = createSupabaseRepository(config, async () => { throw new Error(config.key); });
  await assert.rejects(repository.listProducts(), (error) => error instanceof DatabaseError && !error.message.includes(config.key));
});
