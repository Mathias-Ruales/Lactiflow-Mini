<script setup>
import { onMounted, ref } from 'vue';

const apiBase = (import.meta.env.VITE_ORDERS_API_URL || '/pedidos-api').replace(/\/$/, '');
const orders = ref([]);
const loading = ref(true);
const error = ref('');
const offset = ref(0);
const hasMore = ref(false);
const selected = ref(null);
const detailLoading = ref(false);
const pageSize = 10;
const units = order => order.order_items.reduce((sum, item) => sum + item.quantity, 0);
const date = value => new Intl.DateTimeFormat('es-EC', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guayaquil',
}).format(new Date(value));

async function request(path) {
  const response = await fetch(`${apiBase}${path}`, { signal: AbortSignal.timeout(12000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'No pudimos consultar los pedidos.');
  return body;
}

async function loadOrders(nextOffset = offset.value) {
  loading.value = true;
  error.value = '';
  try {
    const body = await request(`/api/orders?limit=${pageSize}&offset=${nextOffset}`);
    if (!Array.isArray(body.orders)) throw new Error('No pudimos consultar los pedidos.');
    orders.value = body.orders;
    hasMore.value = body.hasMore;
    offset.value = nextOffset;
  } catch (failure) {
    error.value = failure instanceof TypeError || failure.name === 'TimeoutError'
      ? 'No pudimos conectar con el servicio de pedidos. Inténtalo de nuevo.' : failure.message;
  } finally { loading.value = false; }
}

async function openOrder(id) {
  detailLoading.value = true;
  error.value = '';
  try {
    const body = await request(`/api/orders/${id}`);
    if (!body.order?.id || !Array.isArray(body.order.order_items)) throw new Error('No pudimos consultar el pedido.');
    selected.value = body.order;
  } catch (failure) {
    error.value = failure instanceof TypeError || failure.name === 'TimeoutError'
      ? 'No pudimos conectar con el servicio de pedidos. Inténtalo de nuevo.' : failure.message;
  } finally { detailLoading.value = false; }
}

onMounted(() => loadOrders(0));
</script>

<template>
  <section aria-labelledby="history-title">
    <div class="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
      <div>
        <p class="history-eyebrow mb-2">PEDIDOS GUARDADOS</p>
        <h1 id="history-title" class="fw-bold mb-2">{{ selected ? 'Detalle del pedido' : 'Historial de pedidos' }}</h1>
        <p class="text-secondary mb-0">{{ selected ? 'Consulta los productos y cantidades registrados.' : 'Los pedidos más recientes aparecen primero.' }}</p>
      </div>
      <button v-if="selected" class="btn btn-outline-secondary" type="button" @click="selected = null; error = ''">Volver al historial</button>
      <button v-else class="btn btn-outline-secondary" type="button" :disabled="loading" @click="loadOrders(0)">{{ loading ? 'Cargando…' : 'Actualizar' }}</button>
    </div>
    <p v-if="!selected" class="small text-secondary mb-4">Historial compartido de esta demostración. La vista personal se habilitará con el inicio de sesión.</p>
    <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>

    <article v-if="selected" class="history-panel detail-panel">
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div><h2 class="h5 mb-1 fw-semibold">{{ selected.customer_name }}</h2><p class="text-secondary small mb-0">{{ date(selected.created_at) }} · Quito</p></div>
        <span class="history-status">Registrado</span>
      </div>
      <dl class="mb-4"><dt class="small fw-normal text-secondary mb-1">Identificador del pedido</dt><dd class="history-id">{{ selected.id }}</dd></dl>
      <ul class="list-unstyled mb-0">
        <li v-for="item in selected.order_items" :key="item.product_id" class="detail-line py-3">
          <span>{{ item.product_name }}<small class="d-block text-secondary">{{ item.unit }}</small></span><strong class="text-nowrap">{{ item.quantity }} ud.</strong>
        </li>
      </ul>
      <div class="d-flex justify-content-between align-items-center pt-3"><span class="text-secondary">Total de unidades</span><strong class="fs-4">{{ units(selected) }}</strong></div>
    </article>
    <template v-else>
      <p v-if="loading" class="history-panel text-secondary" role="status">Cargando historial…</p>
      <p v-else-if="!error && !orders.length" class="history-panel text-secondary">Todavía no hay pedidos registrados.</p>
      <div v-else class="d-grid gap-3" :aria-busy="detailLoading">
        <article v-for="order in orders" :key="order.id" class="history-panel order-history-row">
          <div class="history-order-info">
            <div class="d-flex align-items-center gap-2 flex-wrap mb-2"><h2 class="h6 mb-0 fw-semibold">{{ order.customer_name }}</h2><span class="history-status">Registrado</span></div>
            <p class="small text-secondary mb-1">{{ date(order.created_at) }} · {{ units(order) }} unidades</p>
            <p class="history-id small text-secondary mb-0">{{ order.id }}</p>
          </div>
          <button class="btn btn-outline-secondary text-nowrap" type="button" :disabled="detailLoading" @click="openOrder(order.id)" :aria-label="`Ver detalle del pedido de ${order.customer_name}`">Ver detalle</button>
        </article>
      </div>
      <nav v-if="!loading && (offset > 0 || hasMore)" class="d-flex justify-content-between align-items-center mt-4" aria-label="Páginas del historial">
        <button class="btn btn-outline-secondary" :disabled="offset === 0" @click="loadOrders(offset - pageSize)">Anterior</button>
        <span class="small text-secondary">Página {{ offset / pageSize + 1 }}</span>
        <button class="btn btn-outline-secondary" :disabled="!hasMore" @click="loadOrders(offset + pageSize)">Siguiente</button>
      </nav>
    </template>
  </section>
</template>

<style scoped>
.history-eyebrow { color: #537463; font-size: .75rem; font-weight: 750; letter-spacing: .13em; }
h1 { font-size: clamp(1.8rem, 4vw, 2.4rem); letter-spacing: -.04em; }
.history-panel { background: #fff; padding: 1.5rem; border: 1px solid #dfe6dd; border-radius: 16px; }
.order-history-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.history-status { font-size: .75rem; background: #e9f3e5; color: #255b43; border-radius: 20px; padding: .3rem .7rem; font-weight: 600; }
.history-id { font-family: ui-monospace, monospace; overflow-wrap: anywhere; }
.history-order-info { min-width: 0; }
.detail-panel { max-width: 800px; }
.detail-line { display: flex; justify-content: space-between; gap: 1rem; border-bottom: 1px solid #edf0e9; }
@media (max-width: 575px) { .order-history-row { align-items: flex-start; flex-direction: column; } .history-panel { padding: 1rem; } }
</style>
