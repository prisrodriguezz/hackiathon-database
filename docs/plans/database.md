# Plan de Base de Datos

## Objetivo

Usar SQLite para acelerar el desarrollo y almacenar proyectos de ley, leyes nacionales y provinciales, fragmentos de texto, relaciones juridicas, conversaciones y resultados del analisis.

SQLite sera suficiente para el prototipo y las primeras pruebas. El diseño debe mantener separadas las entidades y relaciones para permitir una futura migracion a un motor con mejores capacidades de concurrencia si el producto crece.

## Modelo de grafo sobre SQLite

SQLite no necesita ser una base de datos de grafos para representar un grafo. Se utilizara un modelo de nodos y aristas:

- Una tabla de nodos representa entidades juridicas o documentales.
- Una tabla de aristas representa relaciones dirigidas entre nodos.
- Las aristas tienen un tipo, una explicacion, una fuente y un nivel de confianza.
- Las consultas de vecinos y recorridos se resolveran con joins y consultas recursivas cuando sea necesario.

## Tipos de nodos

- **Ley nacional:** norma con jurisdiccion nacional.
- **Ley provincial:** norma asociada a una provincia.
- **Proyecto de ley:** documento cargado por un usuario.
- **Articulo:** unidad normativa perteneciente a una ley o proyecto.
- **Concepto:** tema, derecho, organismo, procedimiento o materia.
- **Jurisdiccion:** pais, provincia u otro ambito aplicable.
- **Organismo:** entidad alcanzada o mencionada por una norma.
- **Fuente documental:** PDF, boletin, publicacion oficial o referencia externa.

## Tipos de aristas

- `relacionada_con`
- `contradice`
- `modifica`
- `deroga`
- `reglamenta`
- `afecta`
- `aplica_en`
- `pertenece_a`
- `menciona`
- `reemplaza`
- `depende_de`

Las aristas deben ser dirigidas cuando el sentido juridico importe. Por ejemplo, un proyecto puede modificar una ley, pero la relacion inversa no debe inferirse automaticamente sin conservar su semantica.

## Entidades principales

### Documentos

Guardar identificador, titulo, tipo, jurisdiccion, nombre original, ubicacion del archivo, estado, fecha, autor de carga y version.

### Fragmentos

Guardar el texto extraido, numero de pagina, articulo o seccion, posicion dentro del documento y referencia al documento original.

### Nodos

Guardar tipo, nombre, descripcion, jurisdiccion, identificador oficial, fuente y estado de validacion.

### Aristas

Guardar nodo origen, nodo destino, tipo de relacion, explicacion, fuente, confianza, fecha de creacion y version del analisis que la produjo.

### Analisis

Guardar proyecto analizado, estado, resumen, modelo utilizado, fecha, duracion, resultado y errores.

### Hallazgos

Guardar el analisis, la relacion encontrada, los nodos involucrados, fragmentos de evidencia, explicacion y nivel de confianza.

### Conversaciones

Guardar conversacion, documento asociado, mensajes, rol, contenido, fecha y fuentes citadas en cada respuesta.

## Busqueda y conocimiento

- Incorporar busqueda de texto completo para titulos, articulos y fragmentos.
- Normalizar nombres de leyes, organismos y jurisdicciones para evitar duplicados.
- Conservar identificadores oficiales cuando existan.
- Permitir busquedas por jurisdiccion y tipo de norma.
- Permitir obtener vecinos directos de un nodo.
- Permitir recorrer relaciones hasta una profundidad limitada.
- Separar relaciones verificadas de relaciones sugeridas por IA.
- Guardar la fuente de cada relacion para poder revisarla o corregirla.

Si mas adelante se incorporan embeddings, deben asociarse a fragmentos y no reemplazar la busqueda textual ni las referencias explicitas. La respuesta del sistema debe poder justificarse sin depender exclusivamente de similitud semantica.

## Carga inicial de leyes

1. Definir fuentes oficiales para leyes nacionales y provinciales.
2. Importar metadatos antes que el texto completo.
3. Validar identificadores, jurisdiccion, fecha y estado de vigencia.
4. Procesar cada documento y separar articulos o secciones.
5. Crear nodos para leyes, articulos, conceptos y organismos relevantes.
6. Crear aristas solo cuando exista una fuente o una marca clara de que son sugeridas.
7. Registrar el lote de importacion para poder repetirlo o revertirlo.

## Versionado y calidad

- No sobrescribir una ley cuando cambie su contenido; crear una nueva version.
- Mantener fecha de vigencia y fecha de consulta.
- Diferenciar texto oficial de texto extraido por OCR.
- Marcar documentos pendientes de revision.
- Registrar quien o que proceso creo cada nodo y arista.
- Permitir desactivar una relacion incorrecta sin eliminar el historial.
- Usar transacciones para importar documentos y sus relaciones.
- Crear copias de seguridad de SQLite antes de cargas masivas.

## Desarrollo con SQLite

- Usar un archivo local por ambiente de desarrollo.
- Mantener migraciones versionadas.
- Activar restricciones de integridad referencial.
- Crear indices para jurisdiccion, tipo de nodo, identificadores y relaciones.
- Evitar guardar archivos PDF grandes dentro de SQLite durante el prototipo; guardar la ruta y los metadatos.
- Definir una estrategia de bloqueo si se ejecutan varios workers.

## Fases de implementacion

### Fase 1: nucleo documental

- Documentos, fragmentos, estados y fuentes.
- Migraciones iniciales.
- Importacion manual de un conjunto pequeno de leyes.

### Fase 2: grafo juridico

- Nodos y aristas.
- Jurisdicciones nacionales y provinciales.
- Busquedas por texto y relaciones directas.

### Fase 3: analisis y evidencia

- Resultados de agentes.
- Hallazgos con fragmentos de evidencia.
- Distincion entre relaciones verificadas y sugeridas.

### Fase 4: operacion y crecimiento

- Versionado de normas.
- Lotes de importacion repetibles.
- Copias de seguridad.
- Evaluacion de migracion a otra base si aumentan la concurrencia o el volumen.

## Criterios de aceptacion

- SQLite puede almacenar leyes nacionales y provinciales sin mezclar jurisdicciones.
- Un proyecto de ley se puede relacionar con otras normas mediante aristas tipadas.
- Cada relacion conserva fuente y nivel de confianza.
- Se pueden buscar leyes por texto, tipo y jurisdiccion.
- El agente puede consultar nodos y relaciones con profundidad limitada.
- Los resultados pueden rastrearse hasta fragmentos concretos del documento.
- Las importaciones y cambios pueden auditarse y versionarse.
