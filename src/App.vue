<template>
  <div class="min-vh-100 bg-light">
    <!-- Navbar -->
    <nav class="navbar navbar-dark bg-dark px-4 py-3 shadow-sm">
      <span class="navbar-brand mb-0 h1 fw-bold text-primary">LactiFlow — Totales</span>
    </nav>

    <div class="container py-4">
      <!-- Week calendar -->
      <div class="bg-white shadow-sm rounded p-3 mb-4">
        <div class="d-flex align-items-center mb-3">
          <button class="btn btn-light border rounded-circle p-0 d-flex align-items-center justify-content-center"
            style="width: 36px; height: 36px;" @click="changeWeek(-1)" aria-label="Semana anterior">&#8249;</button>
          <div class="flex-grow-1 text-center">
            <strong>{{ weekHeader }}</strong>
          </div>
          <button class="btn btn-light border rounded-circle p-0 d-flex align-items-center justify-content-center"
            style="width: 36px; height: 36px;" @click="changeWeek(1)" aria-label="Semana siguiente">&#8250;</button>
        </div>
        <div class="d-flex gap-2">
          <button v-for="d in weekDates" :key="d.iso"
            :class="['btn', 'flex-fill', 'd-flex', 'flex-column', 'align-items-center', 'py-2',
              d.iso === selectedDate ? 'btn-primary' : 'btn-light']"
            @click="selectDate(d.iso)">
            <small class="fw-normal">{{ d.dayName }}</small>
            <span class="fw-bold">{{ d.dayNumber }}</span>
          </button>
        </div>
      </div>

      <!-- Summary stats -->
      <div class="row g-3 mb-4" v-if="data.length > 0">
        <div class="col-sm-6">
          <div class="card shadow-sm border-0 h-100">
            <div class="card-body d-flex align-items-center">
              <div class="bg-primary bg-opacity-10 rounded px-3 py-2 me-3 text-primary fw-bold fs-4">
                {{ totalProducts }}
              </div>
              <div>
                <div class="text-muted small">Productos distintos</div>
                <div class="fw-medium">Para la fecha seleccionada</div>
              </div>
            </div>
          </div>
        </div>
        <div class="col-sm-6">
          <div class="card shadow-sm border-0 h-100">
            <div class="card-body d-flex align-items-center">
              <div class="bg-success bg-opacity-10 rounded px-3 py-2 me-3 text-success fw-bold fs-4">
                {{ totalQuantity }}
              </div>
              <div>
                <div class="text-muted small">Cantidad total estimada</div>
                <div class="fw-medium">Suma de todas las sugerencias</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Error -->
      <div v-if="error" class="alert alert-danger shadow-sm" role="alert">
        {{ error }}
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Cargando...</span>
        </div>
        <p class="text-muted mt-2">Cargando totales...</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="!error && data.length === 0" class="alert alert-info text-center shadow-sm">
        No hay totales para mostrar.
      </div>

      <!-- Totals table -->
      <div v-else-if="data.length > 0" class="bg-white shadow-sm rounded overflow-hidden">
        <table class="table table-hover mb-0 align-middle">
          <thead class="bg-light text-muted">
            <tr>
              <th class="border-bottom-0 py-3 ps-4">Producto</th>
              <th class="border-bottom-0 py-3 text-end">Cantidad</th>
              <th class="border-bottom-0 py-3 pe-4 text-end">Unidad</th>
            </tr>
          </thead>
          <tbody class="border-top-0">
            <tr v-for="item in data" :key="item.product_id">
              <td class="py-3 ps-4 fw-medium">{{ item.product_name || 'Desconocido' }}</td>
              <td class="py-3 text-end fw-bold">{{ item.total_qty }}</td>
              <td class="py-3 pe-4 text-end">
                <span class="badge bg-secondary bg-opacity-10 text-secondary rounded-pill px-3">
                  {{ item.product_unit || 'unidades' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watchEffect } from "vue";

const apiUrl = import.meta.env.VITE_API_URL;

const pad = (n) => String(n).padStart(2, "0");

const toISO = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const parseISO = (str) => {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const getStartOfWeek = (d) => {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - diff);
  return date;
};

const dayNames = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

const selectedDate = ref(toISO(new Date()));
const data = ref([]);
const isLoading = ref(false);
const error = ref("");

const weekDates = computed(() => {
  const start = getStartOfWeek(parseISO(selectedDate.value));
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push({ iso: toISO(d), dayName: dayNames[i], dayNumber: d.getDate() });
  }
  return dates;
});

const weekHeader = computed(() => {
  const first = parseISO(weekDates.value[0].iso);
  const last = parseISO(weekDates.value[6].iso);
  const monthName = (d) => d.toLocaleString("es-EC", { month: "long" });
  return `${monthName(first)} ${first.getDate()} — ${monthName(last)} ${last.getDate()}, ${last.getFullYear()}`;
});

const totalProducts = computed(() => data.value.length);
const totalQuantity = computed(() =>
  data.value.reduce((sum, item) => sum + Number(item.total_qty || 0), 0)
);

function selectDate(iso) {
  selectedDate.value = iso;
}

function changeWeek(dir) {
  const current = parseISO(selectedDate.value);
  const start = getStartOfWeek(current);
  start.setDate(start.getDate() + dir * 7);
  const dayIndex = (current.getDay() + 6) % 7;
  start.setDate(start.getDate() + dayIndex);
  selectedDate.value = toISO(start);
}

watchEffect(async () => {
  isLoading.value = true;
  error.value = "";
  try {
    const res = await fetch(
      `${apiUrl}/api/public/suggestions/summary?date=${selectedDate.value}`
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Error ${res.status}`);
    }
    data.value = await res.json();
  } catch (e) {
    error.value = e.message || "Error al conectar con el servidor";
    data.value = [];
  } finally {
    isLoading.value = false;
  }
});
</script>
