import { createServer } from 'node:http';
import { RequestError, isUuid, validateOrder } from './validation.js';
import { DatabaseError } from './supabase-repository.js';

async function readJson(req) {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new RequestError(415, 'Usa Content-Type: application/json.');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32 * 1024) throw new RequestError(413, 'El pedido supera el tamaño permitido.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch {
    throw new RequestError(400, 'El JSON no es válido.');
  }
}

export function createApp({ repository, origins = ['http://localhost:5173'] }) {
  const server = createServer(async (req, res) => {
    const reply = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(body === undefined ? undefined : JSON.stringify(body));
    };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin');
    try {
      const origin = req.headers.origin;
      if (origin && !origins.includes(origin)) throw new RequestError(403, 'Origen no permitido.');
      if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return reply(204);
      }
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;
      if (req.method === 'GET' && path === '/health') {
        return reply(200, { status: 'ok', service: 'lactiflow-pedidos', mode: 'local-sprint-1' });
      }
      if (req.method === 'GET' && path === '/health/ready') {
        await repository.ready();
        return reply(200, { status: 'ready', database: 'supabase-pedidos' });
      }
      if (req.method === 'GET' && path === '/api/products') {
        return reply(200, { products: await repository.listProducts(), catalog: 'test-products' });
      }
      if (req.method === 'POST' && path === '/api/orders') {
        const order = validateOrder(await readJson(req));
        const saved = await repository.createOrder(order);
        res.setHeader('Location', `/api/orders/${saved.id}`);
        return reply(201, { order: saved });
      }
      if (req.method === 'GET' && path === '/api/orders') {
        const limitText = url.searchParams.get('limit') ?? '10';
        const offsetText = url.searchParams.get('offset') ?? '0';
        if (!/^\d+$/.test(limitText) || !/^\d+$/.test(offsetText)) {
          throw new RequestError(400, 'La paginación no es válida.');
        }
        const limit = Number(limitText), offset = Number(offsetText);
        if (limit < 1 || limit > 50 || offset > 100000 || !Number.isSafeInteger(offset)) {
          throw new RequestError(400, 'La paginación no es válida.');
        }
        const rows = await repository.listOrders({ limit: limit + 1, offset });
        return reply(200, { orders: rows.slice(0, limit), hasMore: rows.length > limit, limit, offset });
      }
      const match = path.match(/^\/api\/orders\/([^/]+)$/);
      if (req.method === 'GET' && match) {
        if (!isUuid(match[1])) throw new RequestError(400, 'El identificador del pedido no es válido.');
        const order = await repository.getOrder(match[1]);
        if (!order) throw new RequestError(404, 'Pedido no encontrado.');
        return reply(200, { order });
      }
      throw new RequestError(404, 'Ruta no encontrada.');
    } catch (error) {
      if (error instanceof RequestError) return reply(error.status, { error: error.message });
      if (error instanceof DatabaseError && error.productUnavailable) {
        return reply(422, { error: 'Uno de los productos no existe o no está disponible.' });
      }
      return reply(503, { error: 'No fue posible completar la operación. Verifica la conexión y la configuración de Pedidos.' });
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  return server;
}
