<script setup>
import { computed, onMounted, ref } from 'vue';
const emit = defineEmits(['view-history']);
const apiBase = (import.meta.env.VITE_ORDERS_API_URL || '/pedidos-api').replace(/\/$/, '');
const products = ref([]);
const quantities = ref({});
const customerName = ref('');
const loading = ref(true);
const catalogError = ref('');
const submitError = ref('');
const submitting = ref(false);
const savedOrder = ref(null);
const refreshing = ref(false);
const refreshMessage = ref('');
const selected = computed(() => products.value.filter(product => Number(quantities.value[product.id]) > 0)
  .map(product => ({ ...product, quantity: Number(quantities.value[product.id]) })));
const totalUnits = computed(() => selected.value.reduce((sum, product) => sum + product.quantity, 0));
const invalidQuantity = computed(() => products.value.some(product => {
  const raw = quantities.value[product.id];
  if (raw === '' || raw == null) return false;
  const quantity = Number(raw);
  return !Number.isInteger(quantity) || quantity < 0 || quantity > 1000;
}));
const canSubmit = computed(() => !loading.value && !catalogError.value && !submitting.value && !invalidQuantity.value &&
  selected.value.length > 0 && customerName.value.trim().length >= 2 && customerName.value.trim().length <= 120);
async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, { ...options, signal: AbortSignal.timeout(12000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'El servicio de pedidos no está disponible.');
  return body;
}
async function loadProducts() {
  loading.value = true;
  catalogError.value = '';
  try {
    const body = await request('/api/products');
    if (!Array.isArray(body.products)) throw new Error('No pudimos cargar el catálogo.');
    products.value = body.products;
    for (const product of products.value) quantities.value[product.id] ??= 0;
  } catch {
    catalogError.value = 'No pudimos cargar los productos. Comprueba que el servicio de pedidos esté iniciado e inténtalo de nuevo.';
  } finally { loading.value = false; }
}
async function submitOrder() {
  if (!canSubmit.value) return;
  submitting.value = true;
  submitError.value = '';
  try {
    const body = await request('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName: customerName.value.trim(),
        items: selected.value.map(product => ({ productId: product.id, quantity: product.quantity })) }) });
    if (!body.order?.id || !Array.isArray(body.order.order_items)) {
      throw new Error('No pudimos confirmar el resultado. Revisa los pedidos guardados antes de repetir el envío.');
    }
    savedOrder.value = body.order;
  } catch (error) {
    submitError.value = error instanceof TypeError || error.name === 'TimeoutError'
      ? 'Se perdió la conexión antes de confirmar el resultado. Comprueba los pedidos guardados antes de volver a enviar.'
      : error.message;
  } finally { submitting.value = false; }
}
async function verifySavedOrder() {
  refreshing.value = true;
  refreshMessage.value = '';
  try {
    const body = await request(`/api/orders/${savedOrder.value.id}`);
    if (!body.order?.id || !Array.isArray(body.order.order_items)) throw new Error('Respuesta no válida.');
    savedOrder.value = body.order;
    refreshMessage.value = 'Pedido recuperado correctamente de la base de datos.';
  } catch { refreshMessage.value = 'No pudimos volver a consultar el pedido. La confirmación inicial se mantiene.'; }
  finally { refreshing.value = false; }
}
function newOrder() {
  savedOrder.value = null;
  submitError.value = '';
  refreshMessage.value = '';
  for (const product of products.value) quantities.value[product.id] = 0;
}
onMounted(loadProducts);
</script>

<template>
  <section aria-labelledby="orders-title">
    <div class="mb-4">
      <p class="eyebrow mb-2">PEDIDOS</p>
      <h1 id="orders-title" class="fw-bold mb-2">{{ savedOrder ? 'Tu pedido quedó registrado' : 'Haz tu pedido' }}</h1>
      <p class="text-secondary mb-0">{{ savedOrder ? 'Guardado en Lactiflow Clientes.' : 'Elige tus productos e indica cuántas unidades necesitas.' }}</p>
    </div>
    <div v-if="savedOrder" class="order-panel confirmation mx-auto" role="status" aria-live="polite">
      <div class="d-flex align-items-center gap-3 mb-4">
        <span class="confirmation-check" aria-hidden="true">✓</span>
        <div><span class="status-pill">Registrado</span><p class="mb-0 mt-2 fw-semibold">{{ savedOrder.customer_name }}</p></div>
      </div>
      <dl class="mb-4"><dt class="text-secondary small fw-normal mb-1">Identificador del pedido</dt><dd class="order-id mb-0">{{ savedOrder.id }}</dd></dl>
      <ul class="list-unstyled mb-4">
        <li v-for="item in savedOrder.order_items" :key="item.product_id" class="summary-line py-3">
          <span>{{ item.product_name }}<small class="d-block text-secondary">{{ item.unit }}</small></span><span class="fw-bold text-nowrap">{{ item.quantity }} ud.</span>
        </li>
      </ul>
      <div class="d-flex flex-wrap gap-2">
        <button class="btn order-button" type="button" @click="newOrder">Nuevo pedido</button>
        <button class="btn btn-outline-secondary" type="button" @click="emit('view-history')">Ver historial</button>
        <button class="btn btn-outline-secondary" type="button" :disabled="refreshing" @click="verifySavedOrder">{{ refreshing ? 'Consultando…' : 'Volver a consultar' }}</button>
      </div>
      <p v-if="refreshMessage" class="small mt-3 mb-0" aria-live="polite">{{ refreshMessage }}</p>
    </div>
    <form v-else @submit.prevent="submitOrder" :aria-busy="submitting">
      <div class="row g-4 align-items-start">
        <div class="col-lg-8">
          <div class="order-panel mb-4">
            <label for="customer-name" class="form-label fw-semibold">Nombre del cliente</label>
            <input id="customer-name" v-model="customerName" type="text" class="form-control form-control-lg" autocomplete="name"
              minlength="2" maxlength="120" required :disabled="submitting" placeholder="Escribe tu nombre" />
          </div>
          <div class="d-flex align-items-center justify-content-between mb-3 gap-2">
            <h2 class="h5 fw-bold mb-0">Productos</h2><span class="test-label">Catálogo de prueba</span>
          </div>
          <div v-if="loading" class="order-panel text-secondary" role="status">Cargando productos…</div>
          <div v-else-if="catalogError" class="order-panel" role="alert">
            <p>{{ catalogError }}</p><button class="btn btn-outline-secondary" type="button" @click="loadProducts">Reintentar</button>
          </div>
          <p v-else-if="!products.length" class="order-panel text-secondary">No hay productos disponibles por ahora.</p>
          <div v-else class="d-grid gap-3">
            <article v-for="product in products" :key="product.id" class="order-panel product-row" :class="{ selected: Number(quantities[product.id]) > 0 }">
              <div class="product-symbol" aria-hidden="true">
                <svg viewBox="0 0 32 32" fill="none" width="30" height="30"><path d="m7 10 9-5 9 5v12l-9 5-9-5V10Z M7 10l9 5 9-5 M16 15v12" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" /></svg>
              </div>
              <div class="product-description"><h3 class="h6 mb-1 fw-semibold">{{ product.name }}</h3><p class="small text-secondary mb-0">{{ product.unit }}</p></div>
              <div class="quantity-field">
                <label :for="`qty-${product.id}`" class="small text-secondary mb-1">Cantidad<span class="visually-hidden"> de {{ product.name }}</span></label>
                <input :id="`qty-${product.id}`" v-model="quantities[product.id]" type="number" min="0" max="1000" step="1" inputmode="numeric" class="form-control text-center" :disabled="submitting" />
              </div>
            </article>
          </div>
        </div>
        <aside class="col-lg-4" aria-label="Resumen del pedido">
          <div class="order-panel summary-panel">
            <h2 class="h5 fw-bold mb-4">Tu pedido</h2>
            <p v-if="!selected.length" class="text-secondary small">Selecciona al menos un producto para empezar.</p>
            <ul v-else class="list-unstyled mb-4">
              <li v-for="item in selected" :key="item.id" class="summary-line pb-3 mb-3"><span>{{ item.name }}</span><span class="fw-semibold text-nowrap">× {{ item.quantity }}</span></li>
            </ul>
            <div class="d-flex justify-content-between align-items-center border-top pt-3 mb-4"><span class="text-secondary">Total de unidades</span><strong class="fs-4">{{ totalUnits }}</strong></div>
            <p v-if="invalidQuantity" class="text-danger small" role="alert">Usa cantidades enteras de 0 a 1000. Cero significa que no seleccionas ese producto.</p>
            <p v-if="submitError" class="text-danger small" role="alert">{{ submitError }}</p>
            <button class="btn order-button w-100 py-3" type="submit" :disabled="!canSubmit">
              <span v-if="submitting" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>{{ submitting ? 'Registrando…' : 'Registrar pedido' }}
            </button>
            <p class="small text-secondary mt-3 mb-0">Tu pedido se guarda en Lactiflow Clientes. Catálogo ficticio para esta demostración.</p>
          </div>
        </aside>
      </div>
    </form>
  </section>
</template>

<style scoped>
.eyebrow { color: #537463; font-size: .75rem; font-weight: 750; letter-spacing: .13em; }
h1 { font-size: clamp(1.8rem, 4vw, 2.4rem); letter-spacing: -.04em; }
.order-panel { background: #fff; padding: 1.5rem; border: 1px solid #dfe6dd; border-radius: 16px; }
.product-row { display: flex; align-items: center; gap: 1rem; transition: border-color .15s; }
.product-row.selected { border-color: #638e70; }
.product-symbol { color: #456c52; background: #edf3e8; border-radius: 12px; padding: .85rem; flex-shrink: 0; }
.product-description { flex: 1; min-width: 0; }
.quantity-field { width: 90px; flex-shrink: 0; }
.test-label { font-size: .75rem; color: #657368; background: #e9eee5; border-radius: 20px; padding: .3rem .6rem; }
.summary-line { display: flex; justify-content: space-between; gap: 1rem; border-bottom: 1px solid #edf0e9; }
.order-button { background: #255b43; color: #fff; font-weight: 650; border-color: #255b43; border-radius: 9px; }
.order-button:hover, .order-button:focus { background: #194832; color: #fff; border-color: #194832; }
.order-button:disabled { background: #dce6db; border-color: #dce6db; color: #5a6d5c; opacity: 1; }
.confirmation { max-width: 720px; }
.confirmation-check { display: grid; place-items: center; width: 52px; height: 52px; border-radius: 50%; background: #e9f3e5; color: #255b43; font-size: 1.6rem; }
.status-pill { font-size: .75rem; background: #e9f3e5; color: #255b43; border-radius: 20px; padding: .3rem .7rem; font-weight: 600; }
.order-id { font-family: ui-monospace, monospace; font-size: .9rem; overflow-wrap: anywhere; }
@media (max-width: 420px) { .order-panel { padding: 1rem; } .product-symbol { display: none; } .quantity-field { width: 74px; } }
</style>
