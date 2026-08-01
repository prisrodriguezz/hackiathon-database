# @legislative/shared

Tipos y utilidades compartidas entre todos los módulos del monorepo. Es el único paquete que puede ser importado por cualquier otro sin riesgo de ciclos.

## Contenido mínimo

- `LegislativeDocument`, `DocumentStatus`, `ParseResult`: contratos de dominio base.
- `statusLabel()`: utilidad de ejemplo para centralizar lógica compartida.

## Uso

```ts
import type { LegislativeDocument } from '@legislative/shared';

const doc: LegislativeDocument = { id: 'x', title: 'Ley', status: 'parsed', createdAt: new Date().toISOString() };
```

## Scripts

```bash
pnpm dev         # build en watch
pnpm build       # compila a dist/
pnpm typecheck   # chequeo de tipos sin emitir
```
