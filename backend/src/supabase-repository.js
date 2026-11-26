export class DatabaseError extends Error {
  constructor(message, { productUnavailable = false } = {}) {
    super(message);
    this.productUnavailable = productUnavailable;
  }
}

export function loadConfig(env = process.env) {
  const rawUrl = env.SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  let url;
  try { url = new URL(rawUrl); } catch {
    throw new Error('Configura SUPABASE_URL en backend/.env con el proyecto nuevo de Pedidos.');
  }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      /TU-PROYECTO|REEMPLAZAR/i.test(rawUrl)) {
    throw new Error('SUPABASE_URL debe ser la URL HTTPS del proyecto Supabase nuevo.');
  }
  if (!key?.startsWith('sb_secret_') || key.includes('REEMPLAZAR') || key.length < 25) {
    throw new Error('Configura SUPABASE_SECRET_KEY con una clave secret del proyecto Pedidos; no uses una clave publicable.');
  }
  const port = Number(env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT no es válido.');
  const origins = (env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5174')
    .split(',').map((value) => value.trim()).filter(Boolean);
  return { url: url.origin, key, port, origins };
}

export function createSupabaseRepository({ url, key }, fetchImpl = fetch) {
  async function request(path, options = {}) {
    try {
      const response = await fetchImpl(`${url}/rest/v1/${path}`, {
        ...options,
        headers: { apikey: key, 'Content-Type': 'application/json', ...options.headers },
        signal: AbortSignal.timeout(5000),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new DatabaseError('La base de datos rechazó la operación.', {
          productUnavailable: data?.code === 'P0001' && data?.message === 'PRODUCT_UNAVAILABLE',
        });
      }
      return data;
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      // No propagar respuestas del proveedor, SQL, URLs ni credenciales al cliente.
      throw new DatabaseError('No fue posible consultar la base de datos.');
    }
  }

  return {
    ready: () => request('products?select=id&limit=1'),
    listProducts: () => request('products?select=id,sku,name,unit&active=eq.true&order=name.asc'),
    listOrders: ({ limit, offset }) => request(
      `orders?select=id,customer_name,status,created_at,order_items(product_id,product_name,unit,quantity)&order=created_at.desc,id.desc&limit=${limit}&offset=${offset}`,
    ),
    createOrder: ({ customerName, items }) => request('rpc/create_order', {
      method: 'POST', body: JSON.stringify({ p_customer_name: customerName, p_items: items }),
    }),
    async getOrder(id) {
      const rows = await request(
        `orders?id=eq.${encodeURIComponent(id)}&select=id,customer_name,status,created_at,order_items(product_id,product_name,unit,quantity)`,
      );
      return rows[0] || null;
    },
  };
}
