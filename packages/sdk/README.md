# @legislative/sdk

Cliente HTTP **tipado** para consumir la API del sistema (`@legislative/api`). Reutiliza los tipos de `@legislative/shared`.

## Variables de entorno

| Variable       | Descripción              | Default                |
| -------------- | ------------------------ | ---------------------- |
| `API_BASE_URL` | Base URL de la API.      | `http://localhost:3000` |

## Uso

```ts
import { createApiClient } from '@legislative/sdk';

const client = createApiClient();
const health = await client.getHealth();
```

## Scripts

```bash
pnpm dev         # build en watch
pnpm build       # compila a dist/
pnpm typecheck   # chequeo de tipos sin emitir
```
