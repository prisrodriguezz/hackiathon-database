# Plan de Frontend

## Objetivo

Crear una interfaz centrada en un chatbot. El usuario debe poder cargar un proyecto de ley en PDF, seguir el estado del analisis, leer los resultados y hacer preguntas sobre el documento desde una misma conversacion.

## Experiencia principal

La pantalla principal debe tener tres zonas:

- **Carga y contexto:** seleccion del PDF, nombre del proyecto, estado y datos basicos.
- **Conversacion:** mensajes del usuario y respuestas del agente.
- **Evidencia:** leyes relacionadas, tipo de relacion, nivel de confianza y referencias al documento o a la base normativa.

La interfaz debe priorizar la lectura y la verificabilidad por encima de mostrar detalles tecnicos del agente.

## Flujo del usuario

1. El usuario abre una nueva conversacion.
2. Selecciona un PDF desde su dispositivo.
3. La interfaz valida el archivo antes de enviarlo.
4. Se muestra el progreso: cargando, extrayendo texto, analizando y listo.
5. Al finalizar, aparece un resumen inicial.
6. El usuario puede abrir las relaciones agrupadas por tipo.
7. El usuario formula preguntas de seguimiento en el chatbot.
8. Cada respuesta puede mostrar las fuentes utilizadas.
9. El usuario puede iniciar otro analisis sin perder el historial anterior.

## Componentes funcionales

- Pantalla de bienvenida con explicacion breve del servicio.
- Selector o zona de arrastre para PDFs.
- Validacion de formato y tamano.
- Indicador de progreso del procesamiento.
- Mensajes de error accionables.
- Encabezado con titulo del proyecto y estado.
- Lista de mensajes del chatbot.
- Compositor de preguntas con estado de envio.
- Tarjetas de leyes relacionadas.
- Vista de detalle de una relacion.
- Panel de fuentes y referencias.
- Historial de documentos y conversaciones.
- Accion para reiniciar o eliminar una conversacion.

## Comunicacion con el backend

El frontend debe tratar el procesamiento como una tarea asincrona:

- Enviar el PDF y los metadatos basicos.
- Recibir un identificador del documento y de la tarea.
- Consultar el estado o recibir actualizaciones del backend.
- Obtener el analisis cuando este disponible.
- Enviar preguntas asociadas al documento correcto.
- Mostrar respuestas parciales solo si el backend garantiza que estan identificadas como parciales.

El frontend no debe llamar directamente a OpenAI ni conocer la clave del proveedor. Toda consulta de IA pasa por el backend.

## Presentacion del analisis

Las relaciones deben organizarse en categorias visibles:

- Leyes relacionadas.
- Posibles contradicciones.
- Leyes afectadas.
- Normas que podria reemplazar o modificar.
- Ambito nacional o provincial.

Cada resultado debe mostrar:

- Nombre y jurisdiccion de la ley.
- Tipo de relacion.
- Explicacion en lenguaje claro.
- Nivel de confianza.
- Fuente consultada.
- Aviso cuando se trate de una inferencia y no de una coincidencia explicita.

## Estados de interfaz

- **Vacio:** todavia no hay un documento cargado.
- **Validando:** se verifica el archivo.
- **Procesando:** el backend extrae y analiza el documento.
- **Listo:** el resumen y el chat estan disponibles.
- **Advertencia:** el analisis termino con informacion incompleta.
- **Error:** se puede reintentar o cargar otro archivo.

El usuario nunca debe quedar mirando una pantalla sin saber si el proceso sigue activo o fallo.

## Accesibilidad y responsive

- Navegacion completa con teclado.
- Etiquetas claras para carga, envio y fuentes.
- Contraste suficiente para categorias y estados.
- No depender solamente del color para distinguir relaciones.
- Mensajes de error compatibles con lectores de pantalla.
- Layout usable en escritorio, tablet y movil.
- En movil, el panel de evidencia puede abrirse como vista secundaria.

## Manejo de incertidumbre

El frontend debe evitar presentar el resultado como asesoramiento juridico definitivo. Debe incluir un aviso visible que indique que el analisis es asistido por IA y requiere revision profesional.

Cuando no existan fuentes suficientes, la respuesta debe indicar que no hay evidencia suficiente en la base cargada. No debe reemplazarse por una respuesta generica que parezca concluyente.

## Fases de implementacion

### Fase 1: carga y chat base

- Pantalla principal.
- Carga de PDF.
- Estado de tarea.
- Conversacion con respuestas del backend.

### Fase 2: evidencia juridica

- Categorias de relaciones.
- Fuentes y referencias.
- Vista de detalle de leyes.
- Indicadores de confianza.

### Fase 3: historial y calidad de uso

- Historial de documentos.
- Reintentos.
- Persistencia de conversaciones.
- Accesibilidad y responsive.

## Criterios de aceptacion

- El usuario puede cargar un PDF desde escritorio y movil.
- El frontend muestra claramente cada estado del procesamiento.
- El chatbot se comunica exclusivamente con el backend.
- Las respuestas muestran fuentes y tipo de relacion.
- Los errores permiten recuperarse sin recargar toda la aplicacion.
- El usuario puede hacer preguntas de seguimiento sobre el documento seleccionado.
