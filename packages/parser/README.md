# @legislative/parser

Conversión de documentos (principalmente PDF) a **Markdown estructurado** para alimentar el análisis legislativo.

## Estrategia

1. **Extracción de texto**: para PDFs digitales se usa `pdf-parse` (`PdfTextReader`).
2. **OCR por IA**: si el documento es escaneado (sin texto extraíble), se delega en un `OcrEngine` que envía las páginas como imágenes a un modelo de visión **OpenAI-compatible** (el mismo proveedor de `@legislative/ai`).
3. **Normalización**: la salida se convierte a Markdown con el proveedor de IA, preservando títulos, artículos y secciones.

La interfaz `OcrEngine` está pensada para implementarse con un modelo de visión (p. ej. `gpt-4o` o un modelo multimodal local).

## Uso

```ts
import { parseDocument } from '@legislative/parser';
import { createLLMProvider } from '@legislative/ai';

const pdf = await Bun.file('proyecto.pdf').arrayBuffer();
const result = await parseDocument(new Uint8Array(pdf), createLLMProvider());
console.log(result.markdown);
```

## Scripts

```bash
pnpm dev         # build en watch
pnpm build       # compila a dist/
pnpm typecheck   # chequeo de tipos sin emitir
```
