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
