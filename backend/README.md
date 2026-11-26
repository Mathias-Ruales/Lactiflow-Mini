# Backend de Lactiflow Pedidos

Incremento del Sprint 1: consultar tres productos ficticios y registrar un pedido con sus cantidades en un proyecto Supabase propio, llamado Lactiflow Clientes. El backend funciona sin iniciar Lactiflow principal. La Mini ahora ofrece un formulario de Pedidos y conserva Totales en una sección separada.

Se usa Node.js 22 o superior, con HTTP y fetch incorporados. No hace falta instalar dependencias adicionales del backend.

## Preparar el proyecto Supabase

1. Entrar al panel de Supabase y crear un proyecto nuevo, por ejemplo `lactiflow-pedidos`, separado del proyecto de Lactiflow principal. Revisar el plan y la disponibilidad de proyectos de la cuenta antes de confirmar. Este repositorio no crea proyectos ni contrata servicios.
2. En el proyecto nuevo, abrir SQL Editor y ejecutar `supabase/001_schema.sql`. Crea las tablas `products`, `orders` y `order_items`, y la función transaccional `create_order`.
3. Ejecutar `supabase/002_test_products.sql`. Inserta tres productos ficticios; no consulta ni copia el catálogo del principal. Repetir esta carga no duplica los mismos identificadores.
4. Obtener la URL del proyecto y una clave de tipo **secret** desde la configuración de API Keys / diálogo Connect del proyecto nuevo. No usar una clave publicable ni las credenciales del principal.
5. Copiar `backend/.env.example` a `backend/.env` y completar `SUPABASE_URL` y `SUPABASE_SECRET_KEY`. Esta clave permanece únicamente en el backend: no lleva prefijo `VITE_`, no se pega en la web y no se sube a GitHub.

Las tablas tienen RLS activado y no conceden acceso a `anon` ni `authenticated`. La función solo puede ejecutarse con el rol de servicio. La secret key obtiene acceso elevado, por lo que esta demo escucha exclusivamente en `127.0.0.1`. La autenticación de usuarios y la autorización de pedidos aún están pendientes; CORS no las sustituye. No desplegar este incremento tal cual como una API pública.

## Ejecutar

Desde la raíz del repositorio:

```sh
npm run backend:dev
```

Para ejecutar sin recarga automática:

```sh
npm run backend:start
```

El puerto predeterminado es `3001`, distinto del backend principal. El arranque valida la configuración y no simula una base de datos si falta. `/health` solo verifica que la API está ejecutándose; `/health/ready` realiza una consulta a la base nueva.

## Endpoints del sprint

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/health` | Estado del servicio local. |
| GET | `/health/ready` | Conexión y acceso a `products`; 503 si falla. |
| GET | `/api/products` | Catálogo ficticio activo del proyecto Pedidos. |
| POST | `/api/orders` | Guarda un pedido y sus detalles; devuelve 201. |
| GET | `/api/orders?limit=10&offset=0` | Historial de la demo, más recientes primero; devuelve `hasMore` para paginar. |
| GET | `/api/orders/:id` | Recupera el pedido guardado y sus productos. |

Ejemplo de pedido:

```json
{
  "customerName": "Cliente de prueba",
  "items": [
    { "productId": "11111111-1111-4111-8111-111111111111", "quantity": 2 }
  ]
}
```

Las cantidades deben ser enteros entre 1 y 1000; no se aceptan pedidos vacíos ni productos repetidos. Los nombres y unidades se obtienen del catálogo del servidor. El estado es `registrado`, que significa guardado localmente, no aceptado ni recibido por Lactiflow principal. Cabecera y productos se insertan en una sola función de PostgreSQL: si algún producto falla, la operación completa se revierte.

La pestaña Historial consulta los pedidos guardados en Supabase y permite abrir su detalle incluso después de recargar la página. Muestra el historial compartido de esta base de prueba, no pedidos filtrados por usuario: el aislamiento personal depende de la autenticación y autorización pendientes. Por ello el servidor sigue limitado a la computadora local.

## Demostración de la review

1. Mantener apagado el backend de Lactiflow principal para evidenciar independencia de Pedidos; la sección Totales sí depende de ese sistema.
2. Iniciar este backend y consultar `/health/ready`.
3. Iniciar `npm run dev` en otra terminal desde la raíz del repositorio. Abrir Vite, entrar a Pedidos, escribir un nombre de prueba, seleccionar cantidades y pulsar Registrar pedido. También se puede usar `demo.http` con Postman u otro cliente HTTP.
4. La confirmación muestra el ID y los productos guardados. Pulsar Volver a consultar para recuperar el pedido desde la base, o consultar `/api/orders/:id`.
5. En Supabase Table Editor, mostrar la cabecera en `orders` y sus detalles en `order_items`. Reiniciar el backend y volver a recuperar el mismo ID para comprobar persistencia.
6. Enviar la cantidad cero: debe responder 400. Enviar el ejemplo con un producto inexistente: debe responder 422 sin dejar una cabecera ni detalles parciales. Comparar los registros antes y después.

## Pruebas y límites de verificación

```sh
npm run test:backend
```

Las pruebas automatizadas verifican HTTP, validación, errores, consulta posterior del pedido y el contrato REST/RPC con dobles de prueba. No usan credenciales ni contactan Supabase. No demuestran por sí solas persistencia real, permisos ni rollback en PostgreSQL: completar la demostración anterior después de crear el proyecto y ejecutar el esquema. No marcar esas tareas como terminadas antes de verificarlo.

Se verificó el flujo del formulario a Supabase con un pedido de prueba, su consulta posterior y la presentación de errores. Pendientes de próximos sprints: identidad central, SSO, MFA, federación, autorización por usuario, comunicación con Lactiflow principal y cifrado mediante KMS.

## Referencias

- [Claves de Supabase y uso exclusivo de secret keys en servidores](https://supabase.com/docs/guides/getting-started/api-keys)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Funciones de PostgreSQL y permisos](https://supabase.com/docs/guides/database/functions)
