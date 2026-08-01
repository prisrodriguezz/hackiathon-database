# @legislative/ui

Componentes React compartidos usados por las aplicaciones del monorepo (y futuro design system).

## Contenido mínimo

- `Button` — botón con variantes `primary` / `secondary`.
- `Card` — contenedor con título opcional.

## Uso

```tsx
import { Button, Card } from '@legislative/ui';

<Card title="Ejemplo">
  <Button onClick={() => alert('ok')}>Aceptar</Button>
</Card>;
```

## Scripts

```bash
pnpm dev         # build en watch
pnpm build       # compila a dist/
pnpm typecheck   # chequeo de tipos sin emitir
```
