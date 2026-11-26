import { createApp } from './app.js';
import { createSupabaseRepository, loadConfig } from './supabase-repository.js';

try {
  const config = loadConfig();
  const app = createApp({ repository: createSupabaseRepository(config), origins: config.origins });
  // Sprint 1 aún no tiene autenticación: escuchar solo en esta computadora.
  app.listen(config.port, '127.0.0.1', () => {
    console.log(`Lactiflow Pedidos: http://127.0.0.1:${config.port}`);
    console.log('Demo local del Sprint 1. Identidad, integración y KMS siguen pendientes.');
  });
  app.on('error', (error) => {
    console.error(error.code === 'EADDRINUSE' ? 'El puerto ya está ocupado. Cambia PORT en backend/.env.' : 'No fue posible iniciar el servicio.');
    process.exitCode = 1;
  });
  const close = () => app.close(() => process.exit(0));
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
