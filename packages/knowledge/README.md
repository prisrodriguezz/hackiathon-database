# @legislative/knowledge

Acceso a la **base de conocimiento** del sistema:

- **Neo4j** — grafo de entidades y relaciones legislativas (`getGraphDriver`).
- **Qdrant** — búsqueda vectorial / semántica (`getVectorStore`).

Las conexiones son **perezosas**: solo se crean al primer uso, por lo que importar el paquete no requiere que las bases estén levantadas.

## Variables de entorno

| Variable          | Descripción          | Default                     |
| ----------------- | -------------------- | --------------------------- |
| `NEO4J_URI`       | URI del driver.      | — (obligatoria al usar)     |
| `NEO4J_USER`      | Usuario de Neo4j.    | `neo4j`                     |
| `NEO4J_PASSWORD`  | Password de Neo4j.   | `neo4j`                     |
| `QDRANT_URL`      | URL de Qdrant.       | `http://localhost:6333`     |

## Uso

```ts
import { getGraphDriver, getVectorStore } from '@legislative/knowledge';

const session = getGraphDriver().session();
const qdrant = getVectorStore();
```

## Scripts

```bash
pnpm dev         # build en watch
pnpm build       # compila a dist/
pnpm typecheck   # chequeo de tipos sin emitir
```
