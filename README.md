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

Por defecto la IA usa `AI_PROVIDER=simulated`. Para un proveedor OpenAI-compatible, configura
`AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY` y `AI_MODEL`; ninguna credencial se devuelve por la API.
