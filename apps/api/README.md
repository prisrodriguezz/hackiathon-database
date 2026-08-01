# @legislative/api

API HTTP del sistema de análisis legislativo. Framework **Hono**, runtime **Bun**.

## Puesta en marcha

```bash
pnpm install                 # desde la raíz del monorepo
pnpm --filter @legislative/api dev
```

El servidor escucha en `http://localhost:3000` (configurable con `PORT`). Bun carga automáticamente el archivo `.env` si existe (copiá `.env.example` a `.env`).

## Endpoints de ejemplo

| Método | Ruta              | Descripción                     |
| ------ | ----------------- | ------------------------------- |
| GET    | `/`               | Info del servicio.              |
| GET    | `/health`         | Healthcheck.                    |
| GET    | `/api/example`    | Ejemplo con tipos compartidos.  |
| GET    | `/api/documents/:id` | Ejemplo con validación zod.   |

## Base de datos (Drizzle + PostgreSQL)

La conexión es **perezosa**: la API arranca aunque no haya base disponible. Para usar la DB:

```bash
cp .env.example .env            # configurar DATABASE_URL
pnpm db:generate                # genera migraciones desde src/db/schema.ts
pnpm db:push                    # aplica el schema a la base (dev)
pnpm db:migrate                 # corre migraciones pendientes
```

## Variables de entorno

Ver `.env.example`. Además de la DB, incluye credenciales para Neo4j, Qdrant e IA (consumidas por otros paquetes).

## Scripts

```bash
pnpm dev         # dev con hot reload (bun --hot)
pnpm build       # bundle de producción con bun build
pnpm typecheck   # chequeo de tipos
```
