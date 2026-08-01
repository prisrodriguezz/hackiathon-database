# Arquitectura

## Flujo de un documento

1. `apps/web` envia el PDF a la API.
2. `apps/api` valida el archivo y registra el documento.
3. `apps/worker` extrae el texto, divide el contenido y genera embeddings.
4. `packages/ai` analiza el proyecto contra el conocimiento disponible.
5. La API expone el resumen, las relaciones y las fuentes al chatbot.

## Responsabilidades

- La web no debe acceder directamente a la base de datos.
- La API maneja autenticacion, permisos y validacion de entrada.
- El worker procesa tareas que pueden tardar varios segundos o minutos.
- El analisis debe conservar las fuentes usadas para que las respuestas sean verificables.
