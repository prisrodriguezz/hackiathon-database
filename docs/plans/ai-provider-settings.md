# Plan de Configuracion del Proveedor de IA

## Objetivo

Permitir que el usuario configure desde la interfaz un proveedor compatible con la API de OpenAI mediante:

- URL base del proveedor.
- API key.
- Modelo a utilizar.

La configuracion debe aplicarse al analisis y al chatbot sin exponer la API key al navegador, a otros usuarios ni a las respuestas de la API.

## Alcance

- Pantalla o modal de configuracion accesible desde la UI.
- Formulario para URL, API key y modelo.
- Validacion local y del backend.
- Accion para probar la conexion.
- Estado visible de la configuracion.
- Aplicacion de la configuracion al agente y sus subagentes.
- Edicion, reemplazo y eliminacion de credenciales.
- Modo simulado para trabajar sin un proveedor externo.

## Experiencia de usuario

### Entrada a la configuracion

Agregar una accion visible en la interfaz, por ejemplo `Configuracion de IA`, sin quitar al usuario del documento o conversacion actual.

La UI debe indicar si se esta usando:

- Proveedor simulado.
- Proveedor configurado por el usuario.
- Proveedor configurado pero con conexion pendiente de verificar.
- Proveedor con error de conexion.

### Formulario

Campos requeridos:

- **URL base:** direccion del endpoint compatible con OpenAI.
- **API key:** campo oculto con opcion para mostrar temporalmente el valor.
- **Modelo:** identificador exacto del modelo.

Campos opcionales futuros:

- Temperatura.
- Limite maximo de tokens.
- Tiempo de espera.
- Cantidad maxima de reintentos.

El formulario debe incluir ayuda breve sobre el formato esperado y aclarar que la URL debe ser la URL base, no una ruta completa de chat completions.

### Acciones

- **Probar conexion:** valida las credenciales y confirma que el modelo responde.
- **Guardar configuracion:** persiste la configuracion si la validacion fue exitosa.
- **Usar modo simulado:** permite analizar documentos sin una API externa.
- **Eliminar credenciales:** borra la API key y vuelve al modo simulado o deja el proveedor sin configurar.
- **Cancelar:** descarta cambios no guardados.

## Validaciones

### En el navegador

- URL obligatoria y con protocolo HTTPS en entornos no locales.
- URL sin espacios ni rutas ambiguas.
- API key no vacia al guardar una configuracion externa.
- Modelo no vacio.
- No mostrar la API key en texto plano despues de guardarla.
- No guardar la API key en `localStorage`, cookies accesibles por JavaScript ni parametros de URL.

### En el backend

- Repetir todas las validaciones, sin confiar en la UI.
- Permitir HTTP solo para proveedores locales de desarrollo.
- Validar que la URL pertenezca a un destino permitido o aplicar una politica contra SSRF.
- Rechazar configuraciones incompletas.
- Probar el modelo configurado antes de marcarlo como activo.
- No registrar la API key en logs, errores ni trazas del agente.

## Flujo de configuracion

1. El usuario abre la configuracion de IA.
2. La UI obtiene solo los datos no sensibles del proveedor activo.
3. El usuario completa o reemplaza URL, API key y modelo.
4. La UI valida el formato basico.
5. El backend recibe la configuracion por una comunicacion segura.
6. El backend realiza una prueba minima contra el endpoint compatible.
7. Si la prueba es correcta, guarda la configuracion y devuelve un identificador o estado, nunca la clave.
8. Los nuevos analisis usan el proveedor activo.
9. Las ejecuciones existentes conservan el modelo utilizado para mantener trazabilidad.

## Proteccion de credenciales

- La API key debe enviarse solo al backend.
- La UI debe mostrar una version enmascarada, por ejemplo los ultimos cuatro caracteres.
- El backend debe almacenar la clave cifrada o mantenerla solo en memoria si el alcance es una sesion local.
- La clave nunca debe persistirse en la base SQLite sin cifrado.
- La clave nunca debe incluirse en resultados de analisis, mensajes, logs o reportes.
- Al cambiar de proveedor, invalidar o reemplazar la configuracion anterior.
- El usuario debe poder eliminar las credenciales almacenadas.
- Las respuestas de error deben ocultar informacion sensible del proveedor.

Para el primer prototipo se debe decidir explicitamente entre:

- **Configuracion por sesion:** mas simple y adecuada para desarrollo local; se pierde al reiniciar el backend.
- **Configuracion persistente cifrada:** necesaria si se desea conservarla entre reinicios o usuarios.

No se debe persistir una clave sin cifrado como solucion temporal.

## Contrato funcional con el backend

La UI necesitara operaciones para:

- Consultar el estado del proveedor activo sin recibir la clave.
- Guardar o reemplazar una configuracion.
- Probar una configuracion sin activarla.
- Activar una configuracion previamente validada.
- Eliminar la configuracion.

El backend debe devolver estados claros, por ejemplo:

- `not_configured`.
- `simulated`.
- `configured`.
- `connection_failed`.
- `invalid_configuration`.

Las respuestas deben incluir proveedor, URL enmascarada, modelo y fecha de actualizacion, pero nunca la API key completa.

## Integracion con agentes

- El agente coordinador obtiene la configuracion activa desde el backend.
- Los subagentes reciben una referencia al cliente configurado, no la clave directamente.
- Todos los subagentes deben usar el mismo proveedor y modelo durante una ejecucion.
- Guardar proveedor y modelo en el registro de cada analisis.
- Si la conexion falla, detener la ejecucion con un error explicito y permitir reintentar.
- No cambiar de modelo silenciosamente durante un analisis.

## Estados y mensajes de UI

- **Sin configurar:** explicar que puede usarse el modo simulado o agregar un proveedor.
- **Validando:** mostrar progreso mientras se prueba la conexion.
- **Configurado:** mostrar proveedor y modelo, con la clave enmascarada.
- **Error de autenticacion:** indicar que se revise la API key sin revelar detalles.
- **Modelo no disponible:** pedir un identificador de modelo valido.
- **URL inaccesible:** indicar que se revise la URL o la disponibilidad del proveedor.
- **Guardando:** bloquear acciones duplicadas.
- **Guardado:** confirmar que la configuracion se aplicara a nuevos analisis.

Los mensajes deben diferenciar un error de configuracion del proveedor de un error del analisis juridico.

## Prueba de conexion

La prueba debe ser pequena, controlada y no iniciar un analisis juridico completo. Debe verificar:

- Que la URL sea accesible.
- Que la autenticacion sea valida.
- Que el modelo exista o responda.
- Que la respuesta tenga el formato esperado.
- Que el tiempo de respuesta este dentro del limite configurado.

Mostrar el resultado, la latencia aproximada y el modelo validado. No mostrar el contenido de la respuesta del proveedor si pudiera incluir datos sensibles.

## Fases de implementacion

### Fase 1: modo simulado y formulario

- Mostrar el estado actual.
- Crear formulario de URL, API key y modelo.
- Validar datos localmente.
- Permitir seleccionar modo simulado.

### Fase 2: backend y prueba de conexion

- Agregar operaciones seguras de configuracion.
- Validar en el backend.
- Implementar prueba de conexion OpenAI-compatible.
- Mostrar estados y errores en la UI.

### Fase 3: persistencia y seguridad

- Definir alcance por sesion, usuario o instalacion.
- Implementar cifrado si las claves deben persistir.
- Agregar eliminacion y reemplazo de credenciales.
- Revisar logs, SSRF, permisos y auditoria.

### Fase 4: integracion completa

- Aplicar la configuracion al agente coordinador.
- Compartir el cliente configurado con subagentes.
- Registrar proveedor y modelo por analisis.
- Agregar pruebas con un proveedor real y uno simulado.

## Criterios de aceptacion

- El usuario puede ingresar URL, API key y modelo desde la UI.
- Una configuracion invalida no puede activarse.
- El usuario puede probar la conexion antes de guardar.
- La API key nunca aparece completa en la UI ni en las respuestas del backend.
- El chatbot usa la configuracion activa para nuevos analisis.
- Cada analisis registra el proveedor y modelo utilizados.
- El usuario puede volver al modo simulado y eliminar sus credenciales.
- Los errores de autenticacion, URL y modelo se muestran de forma diferenciada.
- La configuracion funciona con OpenAI y con un proveedor OpenAI-compatible.
