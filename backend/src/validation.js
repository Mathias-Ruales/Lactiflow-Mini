export class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const isUuid = (value) => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function validateOrder(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new RequestError(400, 'El pedido debe ser un objeto JSON.');
  }
  const name = body.customerName;
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 120) {
    throw new RequestError(400, 'customerName debe contener entre 2 y 120 caracteres.');
  }
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) {
    throw new RequestError(400, 'El pedido debe tener entre 1 y 50 productos.');
  }
  const seen = new Set();
  const items = body.items.map((item) => {
    if (!item || !isUuid(item.productId)) {
      throw new RequestError(400, 'Cada producto debe tener un productId UUID válido.');
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000) {
      throw new RequestError(400, 'La cantidad debe ser un entero entre 1 y 1000.');
    }
    const productId = item.productId.toLowerCase();
    if (seen.has(productId)) throw new RequestError(400, 'No repitas productos en el pedido.');
    seen.add(productId);
    // Los nombres, estados y precios enviados por el cliente no se aceptan como autoridad.
    return { product_id: productId, quantity: item.quantity };
  });
  return { customerName: name.trim(), items };
}
