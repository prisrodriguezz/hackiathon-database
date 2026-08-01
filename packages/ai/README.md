# @legislative/ai

Capa de acceso a modelos de IA **compatible con la API de OpenAI**. Permite apuntar a cualquier proveedor compatible (OpenAI, Ollama, LiteLLM, etc.) cambiando `OPENAI_BASE_URL`.

## Variables de entorno

| Variable          | Descripción                                        | Default            |
| ----------------- | -------------------------------------------------- | ------------------ |
| `OPENAI_API_KEY`  | Clave de API.                                      | — (obligatoria)    |
| `OPENAI_BASE_URL` | Base URL del endpoint compatible.                  | API oficial OpenAI |
| `OPENAI_MODEL`    | Modelo por defecto.                                | `gpt-4o-mini`      |

## Uso

```ts
import { createLLMProvider } from '@legislative/ai';

const provider = createLLMProvider();
const markdown = await provider.complete(
  'Convertí el texto a Markdown.',
  'Texto del documento...',
);
```

## Scripts

```bash
pnpm dev         # build en watch
pnpm build       # compila a dist/
pnpm typecheck   # chequeo de tipos sin emitir
```
