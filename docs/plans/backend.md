# Plan de Backend

## Objetivo

Construir una API que reciba proyectos de ley en PDF, coordine su procesamiento y exponga al chatbot un analisis respaldado por las leyes almacenadas en la base de datos.

El backend debe ser compatible con proveedores que implementen la API de OpenAI. El proveedor, la URL base, el modelo y las credenciales deben ser configurables por ambiente.

## Responsabilidades

- Recibir y validar archivos PDF.
- Registrar cada proyecto de ley y su estado de procesamiento.
- Extraer el texto del PDF y conservar referencias a paginas o secciones.
- Coordinar el agente principal de analisis.
- Permitir que el agente cree subagentes especializados para consultar la base de datos.
- Consolidar las respuestas de los subagentes en un informe comprensible.
- Mantener las fuentes que justifican cada relacion o conclusion.
- Entregar respuestas del chatbot sobre un proyecto especifico.
- Informar el progreso del procesamiento y los errores al frontend.

## Flujo principal

1. El usuario carga un PDF.
2. La API valida el tipo, el tamano y la integridad del archivo.
3. Se crea un registro del documento con estado `uploaded`.
4. El documento pasa a una tarea de procesamiento.
5. Se extrae el texto, se divide en fragmentos y se asocia cada fragmento con su pagina de origen.
6. El agente principal recibe el texto y el objetivo del analisis.
7. El agente crea subagentes segun las necesidades detectadas.
8. Cada subagente consulta la base de datos en modo controlado y devuelve hallazgos con fuentes.
9. El agente principal revisa, combina y clasifica los hallazgos.
10. Se guarda el resultado y el frontend puede mostrarlo en el chat.

## Agente principal y subagentes

El agente principal funciona como coordinador. No debe inventar relaciones ni delegar consultas sin registrar el motivo y el alcance de cada tarea.

Subagentes iniciales sugeridos:

- **Subagente de leyes relacionadas:** busca leyes con temas, conceptos o materias similares.
- **Subagente de contradicciones:** revisa incompatibilidades entre articulos, obligaciones, definiciones y ambitos de aplicacion.
- **Subagente de impacto:** identifica leyes, organismos, derechos, procedimientos o sectores potencialmente afectados.
- **Subagente de jerarquia y jurisdiccion:** distingue leyes nacionales, provinciales y otras normas aplicables.
- **Subagente de verificacion:** revisa que cada conclusion tenga referencias concretas y marca la incertidumbre.

Cada subagente debe devolver:

- Pregunta recibida.
- Leyes y nodos consultados.
- Tipo de relacion encontrada.
- Explicacion breve.
- Referencia a la fuente y al fragmento utilizado.
- Nivel de confianza.
- Limitaciones del analisis.

## Integracion con OpenAI API compatible

- Centralizar la comunicacion con el proveedor en un unico servicio.
- Configurar URL base, clave, modelo, temperatura, limites y tiempos de espera por ambiente.
- Permitir cambiar de proveedor sin modificar la logica del agente.
- Registrar el identificador del modelo usado en cada analisis.
- Evitar enviar claves o datos sensibles al frontend.
- Definir limites de tokens y reintentos para evitar costos o ciclos de delegacion incontrolados.
- Mantener un modo simulado para pruebas sin consumir la API externa.

## Componentes del backend

- **API HTTP:** documentos, analisis, conversaciones y estado de tareas.
- **Servicio de archivos:** almacenamiento y validacion de PDFs.
- **Servicio de extraccion:** texto, paginas, metadatos y deteccion de PDFs sin texto.
- **Orquestador de agentes:** crea, ejecuta y consolida subagentes.
- **Servicio de conocimiento:** busquedas textuales y consultas de relaciones en el grafo.
- **Servicio de chat:** mantiene el contexto del documento y las fuentes.
- **Persistencia:** documentos, tareas, mensajes, resultados, fuentes y auditoria.

## Seguridad y confiabilidad

- Validar extension, MIME, tamano y contenido real del PDF.
- Aislar el texto cargado para que no pueda alterar las instrucciones del agente.
- Tratar el contenido del PDF como datos, no como instrucciones.
- Limitar la cantidad de subagentes y profundidad de delegacion.
- Aplicar timeouts, reintentos y cancelacion de tareas.
- No presentar una conclusion como certeza cuando el analisis tenga baja confianza.
- Registrar errores sin guardar claves ni informacion sensible.
- Mantener trazabilidad de agente, subagente, consulta, fuente y respuesta.

## Fases de implementacion

### Fase 1: API minima

- Carga de PDF.
- Registro de documento.
- Estados de procesamiento.
- Consulta del documento y su estado.

### Fase 2: Procesamiento

- Extraccion de texto por pagina.
- Persistencia de fragmentos.
- Manejo de documentos escaneados como caso pendiente o futura integracion OCR.

### Fase 3: Agente y subagentes

- Agente coordinador.
- Subagentes de relacion, contradiccion e impacto.
- Herramientas de consulta limitadas a la base de datos.
- Consolidacion con fuentes y niveles de confianza.

### Fase 4: Chat y auditoria

- Conversaciones asociadas a documentos.
- Preguntas de seguimiento.
- Historial de mensajes y fuentes.
- Registro de ejecuciones y costos aproximados.

## Criterios de aceptacion

- Un PDF valido puede cargarse y consultar su estado.
- Un PDF invalido se rechaza con un motivo claro.
- El analisis diferencia relaciones, contradicciones e impactos.
- Cada hallazgo muestra las leyes y fragmentos que lo respaldan.
- El agente puede delegar consultas sin perder trazabilidad.
- El proveedor de IA puede cambiarse mediante configuracion.
- Un fallo de la IA o de una tarea no deja el documento en un estado ambiguo.
