# Plan de pruebas: control de ventiladores

## 1. Objetivo

Verificar el funcionamiento del control de ventiladores en los modos manual, mixto y automático, la autorización por roles, el tratamiento de errores, la actualización del estado de las órdenes en el panel y la gestión de órdenes fallidas o expiradas.

## 2. Alcance

Se comprobarán los siguientes aspectos:

- Encendido y apagado de ventiladores.
- Comportamiento según el modo de operación.
- Autorización de administradores, operadores y usuarios con rol `consulta`.
- Protección de la Cloud Function frente a comandos no autorizados.
- Tratamiento de ventiladores inexistentes o sin documento.
- Estado inicial de ventiladores recién creados.
- Transiciones de estado de las órdenes sin recargar el panel.
- Diferenciación visual entre órdenes en curso, fallidas y expiradas.

## 3. Precondiciones

Antes de ejecutar las pruebas:

1. Disponer de un entorno de pruebas con el panel y la Cloud Function desplegados.
2. Tener usuarios de prueba con los roles `administrador`, `operador` y `consulta`.
3. Disponer de ventiladores de prueba identificables y accesibles desde el panel.
4. Poder cambiar el modo de operación entre manual, mixto y automático.
5. Tener acceso a los registros de la Cloud Function y a los documentos de las órdenes.
6. Poder detener y arrancar el simulador de ventiladores.
7. Poder apagar el servicio responsable de procesar las órdenes durante más de 60 segundos, en un entorno controlado.
8. Verificar que los relojes del entorno y los tiempos de expiración sean coherentes.

**Nota:** ejecutar las pruebas destructivas o que impliquen detener servicios únicamente en un entorno de pruebas.

## 4. Datos de prueba

| Dato | Descripción |
|---|---|
| Usuario administrador | Usuario con permisos administrativos |
| Usuario operador | Usuario autorizado para operar ventiladores según las políticas del sistema |
| Usuario consulta | Usuario con permisos exclusivamente de lectura |
| Ventilador existente | Ventilador con documento y estado conocidos |
| Ventilador recién creado | Ventilador sin confirmación inicial de estado |
| Ventilador inexistente | Identificador que no corresponde a ningún ventilador |
| Ventilador sin documento | Referencia cuyo documento requerido no existe |
| Simulador detenido | Simulador que no procesa las órdenes |
| Servicio de órdenes apagado | Servicio que permanece inactivo durante más de 60 segundos |

## 5. Casos de prueba

### CP-01. Encendido manual con administrador

**Precondiciones**
- Usuario autenticado con rol `administrador`.
- Modo de operación manual.
- Ventilador existente y apagado.

**Pasos**
1. Abrir `/ventiladores`.
2. Seleccionar el ventilador.
3. Ejecutar el comando de encendido.
4. Observar el estado de la orden y del ventilador.

**Resultado esperado**
- El comando es aceptado.
- La orden se procesa conforme al flujo definido.
- El panel refleja los cambios de estado sin requerir una recarga.
- El estado final del ventilador se actualiza tras recibir la confirmación correspondiente.

### CP-02. Apagado manual con administrador

**Precondiciones**
- Usuario administrador.
- Modo manual.
- Ventilador encendido.

**Pasos**
1. Abrir el panel de ventiladores.
2. Seleccionar el ventilador encendido.
3. Ejecutar el comando de apagado.

**Resultado esperado**
- El comando es aceptado.
- La orden se procesa correctamente.
- El panel refleja la confirmación del apagado.

### CP-03. Encendido manual con operador

**Precondiciones**
- Usuario con rol `operador`.
- Modo manual.
- Ventilador apagado.

**Pasos**
1. Abrir `/ventiladores`.
2. Seleccionar el ventilador.
3. Ejecutar el comando de encendido.

**Resultado esperado**
- El operador puede encender el ventilador si la política de permisos lo autoriza.
- La orden queda registrada y se actualiza en el panel.
- No se requieren permisos administrativos adicionales para una operación permitida.

### CP-04. Apagado manual con operador

**Precondiciones**
- Usuario operador.
- Modo manual.
- Ventilador encendido.

**Pasos**
1. Seleccionar el ventilador.
2. Ejecutar el comando de apagado.
3. Comprobar la orden y el estado confirmado.

**Resultado esperado**
- El comando es aceptado si el rol operador tiene permiso.
- La orden se procesa y el panel refleja el resultado.

### CP-05. Encendido mixto con administrador

**Precondiciones**
- Usuario administrador.
- Modo mixto.
- Ventilador apagado.

**Pasos**
1. Abrir `/ventiladores`.
2. Seleccionar el ventilador.
3. Ejecutar el encendido manual permitido por el modo mixto.

**Resultado esperado**
- El sistema acepta la operación si las reglas del modo mixto lo permiten.
- No se contradicen las reglas automáticas de control.
- La orden y el estado se actualizan de acuerdo con las confirmaciones recibidas.

### CP-06. Apagado mixto con administrador

**Precondiciones**
- Usuario administrador.
- Modo mixto.
- Ventilador encendido.

**Pasos**
1. Seleccionar el ventilador.
2. Ejecutar el apagado.
3. Comprobar la respuesta del sistema.

**Resultado esperado**
- El comando se acepta cuando está permitido por las reglas del modo mixto.
- El panel refleja el resultado confirmado de la operación.

### CP-07. Encendido mixto con operador

**Precondiciones**
- Usuario operador.
- Modo mixto.
- Ventilador apagado.

**Pasos**
1. Entrar en `/ventiladores`.
2. Seleccionar el ventilador.
3. Ejecutar el encendido.

**Resultado esperado**
- El comando se acepta si el rol y las reglas del modo mixto lo permiten.
- La orden aparece en el panel y se actualiza sin recargar.

### CP-08. Apagado mixto con operador

**Precondiciones**
- Usuario operador.
- Modo mixto.
- Ventilador encendido.

**Pasos**
1. Seleccionar el ventilador.
2. Ejecutar el apagado.
3. Observar el estado de la orden.

**Resultado esperado**
- El comando se acepta si la política de permisos lo permite.
- El resultado se refleja en el panel tras la confirmación.

### CP-09. Rechazo de comando en modo automático

**Precondiciones**
- Usuario autorizado para operar en los modos permitidos.
- Modo automático.
- Ventilador existente.

**Pasos**
1. Cambiar el sistema a modo automático.
2. Intentar enviar un comando manual de encendido.
3. Repetir la prueba con un comando de apagado.
4. Inspeccionar la respuesta y los registros de la orden.

**Resultado esperado**
- Los comandos manuales no se ejecutan cuando el modo automático los prohíbe.
- El sistema informa claramente que la operación no está permitida en ese modo.
- No se crea una orden ejecutable ni se produce un cambio de estado no autorizado.
- La restricción se aplica también en el backend, no solo en la interfaz.

## 6. Autorización y seguridad

### CP-10. Redirección del rol consulta

**Precondiciones**
- Usuario autenticado con rol `consulta`.

**Pasos**
1. Intentar acceder directamente a `/ventiladores`.
2. Comprobar la ruta final y la pantalla mostrada.

**Resultado esperado**
- El usuario es redirigido a la pantalla de no autorizado definida por la aplicación.
- No se muestra la interfaz de control restringida.

### CP-11. Rechazo de comando directo a la Cloud Function

**Precondiciones**
- Usuario con rol `consulta`.
- Acceso al mecanismo de invocación de la Cloud Function en el entorno de pruebas.

**Pasos**
1. Autenticarse como usuario `consulta`.
2. Invocar directamente la Cloud Function de control con un comando válido de encendido.
3. Repetir con un comando de apagado.
4. Inspeccionar la respuesta del backend, los registros y los documentos de órdenes.

**Resultado esperado**
- La Cloud Function rechaza ambas operaciones por falta de autorización.
- El backend verifica la identidad y el rol independientemente de las restricciones de la interfaz.
- No se ejecuta el comando ni se crea una orden ejecutable como consecuencia de la solicitud rechazada.
- La respuesta indica un error de autorización claro, sin exponer información sensible.

## 7. Tratamiento de ventiladores inexistentes

### CP-12. Ventilador inexistente

**Precondiciones**
- Usuario autorizado.
- Identificador de ventilador que no existe.

**Pasos**
1. Intentar consultar el ventilador mediante el flujo habitual del panel.
2. Intentar enviar un comando para ese identificador.

**Resultado esperado**
- El panel muestra un mensaje claro, por ejemplo: «El ventilador solicitado no existe».
- El sistema no presenta un error genérico sin contexto.
- El backend rechaza el comando.
- No se crea una orden ejecutable para un ventilador inexistente.

### CP-13. Ventilador sin documento requerido

**Precondiciones**
- Usuario autorizado.
- Referencia de ventilador cuyo documento requerido no está disponible.

**Pasos**
1. Intentar consultar el estado.
2. Intentar enviar un comando de control.
3. Revisar el mensaje mostrado y los registros del backend.

**Resultado esperado**
- El sistema identifica que faltan los datos o el documento del ventilador.
- Se muestra un mensaje comprensible, por ejemplo: «No se encontró la información del ventilador».
- No se muestra únicamente un error genérico.
- No se genera una orden ejecutable a partir de datos incompletos.

## 8. Estado inicial de un ventilador

### CP-14. Ventilador recién creado

**Precondiciones**
- Posibilidad de crear un ventilador de prueba.
- El ventilador todavía no ha enviado una confirmación de estado.

**Pasos**
1. Crear el ventilador.
2. Abrir o actualizar la lista de ventiladores.
3. Consultar su estado antes de recibir la primera confirmación.
4. Simular la primera confirmación válida.
5. Observar la actualización del panel.

**Resultado esperado**
- Antes de la primera confirmación, el estado aparece como **Desconocido**.
- El sistema no lo muestra como encendido ni apagado sin evidencia.
- Tras recibir la primera confirmación válida, el estado se actualiza según los datos recibidos.

## 9. Flujo de estados de las órdenes

### CP-15. Transición completa sin recargar el panel

**Precondiciones**
- Usuario autorizado.
- Ventilador existente.
- Simulador y servicio de procesamiento activos.
- Panel abierto con sus mecanismos de actualización en tiempo real funcionando.

**Pasos**
1. Abrir `/ventiladores`.
2. Enviar un comando de encendido o apagado.
3. Observar la misma orden durante todo el procesamiento.
4. Registrar las transiciones visibles en el panel.
5. Verificar que no es necesario recargar la página.

**Resultado esperado**
- La orden recorre los estados definidos en el siguiente orden:

  `pendiente → enviando → enviada → ejecutada`

- Cada transición se refleja en el panel sin recargar.
- La orden conserva su identidad durante todo el flujo.
- El estado final `ejecutada` se muestra solo cuando existe confirmación suficiente de ejecución según el contrato del sistema.
- No se confunde el envío del comando con su ejecución efectiva.

## 10. Órdenes fallidas y expiradas

### CP-16. Orden fallida con el simulador detenido

**Precondiciones**
- Entorno de pruebas.
- Simulador detenido.
- Servicio de procesamiento configurado para detectar o informar el fallo.

**Pasos**
1. Detener el simulador.
2. Enviar una orden válida a un ventilador de prueba.
3. Esperar el tiempo definido para detectar el fallo.
4. Observar el estado final en el panel.

**Resultado esperado**
- La orden se identifica como **Fallida** (`fallida`).
- El panel muestra un mensaje que indique que no se pudo completar la operación.
- La orden fallida se distingue visualmente de las órdenes en curso.
- No se presenta como ejecutada sin confirmación.

### CP-17. Orden expirada con el servicio apagado durante más de 60 segundos

**Precondiciones**
- Entorno de pruebas.
- Servicio responsable del procesamiento de órdenes apagado.
- Política de expiración configurada para más de 60 segundos sin procesamiento o confirmación, según el diseño del sistema.

**Pasos**
1. Apagar el servicio responsable de procesar las órdenes.
2. Enviar una orden válida, si la arquitectura permite registrar órdenes durante la interrupción.
3. Mantener el servicio apagado durante más de 60 segundos.
4. Comprobar la aplicación de la política de expiración.
5. Consultar el estado en el panel.
6. Restaurar el servicio y verificar que la orden expirada no se presenta como ejecutada sin una nueva confirmación válida.

**Resultado esperado**
- La orden se identifica como **Expirada** (`expirada`) cuando se cumple la condición de expiración definida.
- El panel diferencia claramente el estado expirado del estado fallido y de los estados en curso.
- El usuario puede identificar que se agotó el tiempo de espera.
- La orden expirada no se presenta como ejecutada sin confirmación válida.

**Nota técnica:** si la arquitectura impide crear órdenes cuando el servicio está apagado, documentar esa limitación y adaptar la prueba para registrar la orden antes de interrumpir el servicio. El criterio de expiración debe verificarse contra la implementación real.

## 11. Matriz de estados esperados

| Estado interno | Significado | Presentación esperada |
|---|---|---|
| `pendiente` | Orden registrada, a la espera de procesamiento | En curso |
| `enviando` | Orden en proceso de envío | En curso |
| `enviada` | Orden enviada, pendiente de confirmación de ejecución | En curso |
| `ejecutada` | Ejecución confirmada | Completada |
| `fallida` | Se ha detectado un fallo de procesamiento o ejecución | Fallida, diferenciada de las órdenes en curso |
| `expirada` | Se ha superado el tiempo límite definido | Expirada, diferenciada de fallidas y órdenes en curso |

El texto y la presentación visual definitivos deben coincidir con las convenciones del panel. No se debe depender exclusivamente del color para comunicar el estado.

## 12. Registro de resultados

Completar esta tabla durante la ejecución de las pruebas.

| Caso | Resultado (OK/KO) | Evidencia o incidencia | Fecha |
|---|---|---|---|
| CP-01 | | | |
| CP-02 | | | |
| CP-03 | | | |
| CP-04 | | | |
| CP-05 | | | |
| CP-06 | | | |
| CP-07 | | | |
| CP-08 | | | |
| CP-09 | | | |
| CP-10 | | | |
| CP-11 | | | |
| CP-12 | | | |
| CP-13 | | | |
| CP-14 | | | |
| CP-15 | | | |
| CP-16 | | | |
| CP-17 | | | |

## 13. Criterios de aceptación

La prueba global se considera satisfactoria cuando:

- Los comandos permitidos funcionan para los roles autorizados y los modos correspondientes.
- El modo automático bloquea los comandos manuales que no estén permitidos.
- El rol `consulta` no puede acceder a la interfaz restringida ni ejecutar comandos mediante invocación directa de la Cloud Function.
- Los ventiladores inexistentes o sin documentos requeridos producen mensajes claros.
- Los ventiladores recién creados permanecen en estado `Desconocido` hasta recibir una confirmación válida.
- El panel actualiza las órdenes en tiempo real y muestra las transiciones esperadas sin recargar.
- Los estados `fallida` y `expirada` se distinguen de los estados en curso y entre sí.
- No se informa de una ejecución exitosa sin confirmación válida.

**Resultado final de la campaña:** Pendiente de ejecución y registro de evidencias.
