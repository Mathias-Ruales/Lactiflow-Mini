<script setup>
import { onUnmounted, ref, watch } from 'vue';
import OrderForm from './components/OrderForm.vue';
import TotalsDashboard from './components/TotalsDashboard.vue';
import OrderHistory from './components/OrderHistory.vue';
const readView = () => ({ '#historial': 'history', '#totales': 'totals' })[window.location.hash] || 'orders';
const view = ref(readView());
const syncView = () => { view.value = readView(); };
window.addEventListener('hashchange', syncView);
onUnmounted(() => window.removeEventListener('hashchange', syncView));
watch(view, value => {
  const hash = { orders: '#pedidos', history: '#historial', totals: '#totales' }[value];
  window.history.replaceState(null, '', hash);
});
</script>

<template>
  <div class="app-shell min-vh-100">
    <header class="app-header">
      <div class="container d-flex flex-wrap align-items-center justify-content-between gap-3 py-3">
        <a class="brand text-decoration-none" href="#" @click.prevent="view = 'orders'" aria-label="Lactiflow Clientes, inicio">
          <span class="brand-mark" aria-hidden="true">L</span>
          <span>LactiFlow <span class="brand-secondary">Clientes</span></span>
        </a>
        <nav class="d-flex gap-2" aria-label="Secciones">
          <button class="section-tab" :class="{ active: view === 'orders' }" :aria-current="view === 'orders' ? 'page' : undefined" @click="view = 'orders'">Pedidos</button>
          <button class="section-tab" :class="{ active: view === 'history' }" :aria-current="view === 'history' ? 'page' : undefined" @click="view = 'history'">Historial</button>
          <button class="section-tab" :class="{ active: view === 'totals' }" :aria-current="view === 'totals' ? 'page' : undefined" @click="view = 'totals'">Totales</button>
        </nav>
      </div>
    </header>
    <main class="container py-4 py-md-5">
      <OrderForm v-show="view === 'orders'" @view-history="view = 'history'" />
      <OrderHistory v-if="view === 'history'" />
      <section v-if="view === 'totals'">
        <h1 class="h2 fw-bold mb-2">Totales de producción</h1>
        <p class="text-secondary mb-4">Consulta las sugerencias del sistema principal por fecha.</p>
        <TotalsDashboard />
      </section>
    </main>
  </div>
</template>

<style>
:root { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #182d28; }
body { margin: 0; background: #f5f7f4; }
.app-shell { background: #f5f7f4; color: #182d28; }
.app-header { background: #fff; border-bottom: 1px solid #e1e7df; }
.brand { display: flex; align-items: center; gap: .7rem; color: #183b30; font-size: 1.25rem; font-weight: 750; }
.brand:hover { color: #183b30; }
.brand-mark { width: 38px; height: 38px; border-radius: 12px; background: #235b46; color: white; display: grid; place-items: center; font-size: 1.3rem; }
.brand-secondary { color: #6a7971; font-weight: 450; }
.section-tab { border: 0; border-radius: 9px; padding: .55rem 1rem; background: transparent; color: #5e6e64; font-weight: 600; }
.section-tab.active { background: #eaf2e9; color: #235b46; }
.section-tab:focus-visible, button:focus-visible, a:focus-visible { outline: 3px solid #719b81; outline-offset: 3px; }
.form-control:focus { border-color: #6d9678; box-shadow: 0 0 0 .2rem #235b461a; }
</style>
