ESTE ES EL COMANDO PARA INICIALIZAR LA APP: corepack pnpm dev

EL PDF DE EJEMPLO ESTÁ EN LA CARPETA DOCS (proyecto_ley_corrientes.pdf)

# Law Analyzer

Aplicacion para cargar proyectos de ley en PDF y analizarlos con ayuda de IA.

## Estructura

- `apps/web`: interfaz web y chatbot.
- `apps/api`: API HTTP, autenticacion y acceso a datos.
- `apps/worker`: tareas pesadas de PDFs, embeddings y analisis.
- `packages/ai`: integracion con el proveedor de IA.
- `packages/database`: esquema, migraciones y cliente de base de datos.
- `packages/parser`: extraccion y limpieza de texto de PDFs.
- `packages/shared`: tipos y validaciones compartidas.
- `docs`: decisiones y documentacion tecnica.

## Inicio

1. Copiar `.env.example` a `.env` y completar las variables necesarias.
2. Instalar dependencias con `pnpm install`.
3. Ejecutar los servicios con `pnpm dev`.

`pnpm` administra las dependencias y los workspaces. Bun es el runtime de la API,
el worker y las herramientas de desarrollo del frontend.

Los archivos PDF locales se guardan en `storage/`, que no se versiona.

La base de datos local usa SQLite en `storage/law-analyzer.db`. El paquete `@law-analyzer/database`
aplica automáticamente las migraciones versionadas al abrir la conexión; `DATABASE_URL` acepta
`sqlite:./ruta/al/archivo.db` o `sqlite::memory:` para pruebas.

## API

- `POST /documents`: carga multipart con `file` PDF y campos opcionales `title`, `documentType` y `uploadedBy`.
- `GET /documents/:id` y `GET /documents/:id/status`: consulta del documento y su procesamiento.
- `POST /documents/:id/analyses`: inicia un analisis asincrono; acepta `{ "goal": "..." }`.
- `GET /analyses/:id`: resultado y trazabilidad de los agentes.
- `POST /documents/:id/conversations` y `POST /conversations/:id`: chat con fuentes del documento.
- `GET /ai/provider`: estado público del proveedor activo, sin devolver la clave.
- `POST /ai/provider/test`: prueba una configuración sin activarla.
- `POST /ai/provider`: prueba y activa una configuración durante la sesión.
- `POST /ai/provider/simulated` y `DELETE /ai/provider`: vuelven al modo simulado y eliminan la clave en memoria.
- `GET /ai/ocr`, `POST /ai/ocr/test`, `POST /ai/ocr` y `DELETE /ai/ocr`: consultan, prueban, activan o eliminan la configuración de Mistral OCR.

Por defecto la IA usa `AI_PROVIDER=simulated`. Para un proveedor OpenAI-compatible, configura
`AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY` y `AI_MODEL`; ninguna credencial se devuelve por la API.

### Configuracion desde `.env`

Para conservar la configuracion entre reinicios, copia `.env.example` a `.env` y completa las
variables antes de iniciar el backend:

- `AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY` y `AI_MODEL`: proveedor principal del analisis.
- `MISTRAL_OCR_BASE_URL`, `MISTRAL_OCR_API_KEY` y `MISTRAL_OCR_MODEL`: OCR para PDFs escaneados.
- `AI_TIMEOUT_MS`: tiempo maximo de espera; el valor recomendado local es `90000`.

Bun carga `.env` automaticamente al iniciar la API y el worker. Reinicia los servicios despues de
cambiarlo. La configuracion enviada desde la interfaz sigue siendo temporal y tiene prioridad durante
la sesion actual. No subas `.env` al repositorio.

La configuración enviada desde la interfaz se mantiene únicamente en memoria dentro de la API:
se pierde al reiniciar el proceso y nunca se guarda en SQLite, `localStorage` o cookies. El backend
valida HTTPS para destinos no locales, bloquea destinos privados y prueba el modelo antes de activarlo.

Mistral OCR se invoca solo cuando el PDF no contiene texto extraíble. Su configuración usa
`MISTRAL_OCR_BASE_URL`, `MISTRAL_OCR_API_KEY` y `MISTRAL_OCR_MODEL` como alternativa para el worker;
la configuración realizada desde la interfaz se aplica al procesamiento inline de la API.
