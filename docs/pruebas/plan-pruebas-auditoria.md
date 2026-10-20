# Plan de pruebas: auditoría del sistema

## 1. Información general

- **Proyecto:** Sistema de gestión y monitorización de incubadoras.
- **Documento:** Plan de pruebas del módulo de auditoría.
- **Ruta:** `docs/pruebas/plan-pruebas-auditoria.md`
- **Fecha:** 20/10/2026.
- **Responsable:** Equipo de pruebas.
- **Estado:** Pendiente de ejecución.

## 2. Objetivo

Verificar que el sistema registre correctamente los eventos relevantes, identifique al usuario que realiza cada acción, proteja los datos sensibles, controle el acceso según el rol y permita consultar el historial mediante filtros y paginación.

También se comprobará que las acciones rechazadas no generen eventos de auditoría y que los reintentos de una misma ejecución de un trigger no creen registros duplicados cuando la implementación requiera idempotencia.

## 3. Alcance

Se probarán los siguientes eventos:

1. Creación y modificación de usuarios.
2. Creación y modificación de incubadoras.
3. Registro de dispositivos.
4. Envío de comandos manuales a ventiladores.
5. Creación o modificación de reglas de automatización.
6. Modificación de umbrales.
7. Reconocimiento de alertas.
8. Resolución automática de alertas con el usuario `sistema`.
9. Rechazo de acciones por permisos insuficientes.
10. Protección de contraseñas y otros datos sensibles.
11. Restricciones de acceso a la pantalla y a la colección de auditoría.
12. Filtrado por tipo de evento y acción «Cargar más».
13. Prevención de eventos duplicados ante reintentos de triggers.

## 4. Precondiciones

Antes de ejecutar las pruebas, verificar:

- [ ] Firestore está disponible en el entorno de pruebas.
- [ ] Las reglas de seguridad están desplegadas.
- [ ] Existe una cuenta de administrador.
- [ ] Existe una cuenta de operador.
- [ ] Existe una cuenta de consulta.
- [ ] Las cuentas tienen los roles asignados correctamente.
- [ ] Existe una incubadora de prueba.
- [ ] Existe un dispositivo asociado a la incubadora.
- [ ] Existe un ventilador de prueba, si corresponde.
- [ ] Existen umbrales y reglas de automatización configurados.
- [ ] Hay alertas de prueba disponibles.
- [ ] El módulo de auditoría está integrado con las funciones que deben registrar eventos.
- [ ] La pantalla de auditoría dispone de filtro por tipo y paginación mediante «Cargar más».
- [ ] Se dispone de acceso autorizado a los registros del servidor y a Firestore para verificar los resultados.

**Precaución:** realizar las pruebas en un entorno controlado. No utilizar cuentas reales ni datos sensibles de usuarios reales.

## 5. Estructura esperada de un evento

Los documentos de la colección `auditoria` deben respetar el modelo de datos implementado en el proyecto.

Como referencia, se comprobarán los siguientes campos:

| Campo | Comprobación |
|---|---|
| `tipoEvento` | Identifica la clase de evento registrado. |
| `entidadAfectada` | Identifica la entidad modificada o la acción auditada. |
| `usuarioId` | Identifica al usuario responsable o contiene `sistema` para acciones automáticas. |
| `detalle` | Describe la acción sin incluir información sensible. |
| `ocurridoEn` | Contiene la marca temporal del evento. |

Los nombres de campos y tipos de evento deben coincidir con los definidos en `functions/lib/auditoria.js` y con el modelo de datos vigente.

## 6. Casos de prueba funcionales

### PA-001: creación de usuario

**Objetivo:** comprobar que la creación de un usuario genere un evento de auditoría.

**Procedimiento:**

1. Iniciar sesión con una cuenta de administrador.
2. Abrir la pantalla de usuarios.
3. Crear un usuario de prueba con datos ficticios.
4. Confirmar que la operación finalice correctamente.
5. Consultar la colección `auditoria`.
6. Buscar el evento correspondiente a la operación.

**Resultado esperado:**

- El usuario se crea correctamente.
- Se registra un evento del tipo `usuario_modificado`, según la convención definida en el proyecto.
- `usuarioId` corresponde al administrador que realizó la operación.
- `entidadAfectada` identifica al usuario creado.
- `ocurridoEn` contiene una marca temporal válida.
- `detalle` no contiene contraseñas ni credenciales.

**Estado:** Pendiente.

### PA-002: modificación de usuario

**Objetivo:** verificar el registro de una modificación de usuario.

**Procedimiento:**

1. Iniciar sesión como administrador.
2. Seleccionar un usuario de prueba.
3. Modificar uno de sus datos permitidos.
4. Guardar los cambios.
5. Consultar la colección `auditoria`.

**Resultado esperado:**

- La modificación se guarda correctamente.
- Se registra un evento de modificación de usuario.
- El evento identifica al administrador y al usuario afectado.
- El detalle describe el cambio sin exponer datos sensibles.

**Estado:** Pendiente.

### PA-003: creación de incubadora

**Objetivo:** comprobar que la creación de una incubadora quede auditada.

**Procedimiento:**

1. Iniciar sesión con el rol autorizado.
2. Crear una incubadora de prueba.
3. Confirmar que el registro aparezca en el sistema.
4. Buscar el evento correspondiente en `auditoria`.

**Resultado esperado:**

- La incubadora se crea correctamente.
- Se registra el evento `incubadora_modificada`, de acuerdo con la convención del proyecto.
- El evento identifica al usuario y la entidad afectada.
- El detalle no incluye datos sensibles.

**Estado:** Pendiente.

### PA-004: modificación de incubadora

**Objetivo:** verificar que la modificación de una incubadora genere un evento.

**Procedimiento:**

1. Abrir una incubadora de prueba.
2. Modificar un campo permitido.
3. Guardar los cambios.
4. Consultar los registros de auditoría.

**Resultado esperado:**

- La modificación se guarda correctamente.
- Se genera el evento correspondiente.
- El usuario responsable y la entidad afectada quedan identificados.
- El detalle refleja la operación realizada.

**Estado:** Pendiente.

### PA-005: registro de dispositivo

**Objetivo:** comprobar que la creación de un dispositivo genere un evento de auditoría.

**Procedimiento:**

1. Seleccionar una incubadora de prueba.
2. Registrar un dispositivo nuevo.
3. Confirmar que el dispositivo quede asociado a la incubadora.
4. Consultar `auditoria`.

**Resultado esperado:**

- El dispositivo se registra correctamente.
- Se genera un evento `dispositivo_registrado`.
- La entidad afectada identifica el dispositivo o su ruta.
- El evento queda registrado de forma consistente con la operación.

**Estado:** Pendiente.

### PA-006: envío de comando manual a un ventilador

**Objetivo:** comprobar que el envío exitoso de un comando manual quede registrado.

**Procedimiento:**

1. Iniciar sesión con un usuario que tenga permiso para controlar ventiladores.
2. Abrir el módulo correspondiente.
3. Enviar un comando permitido al ventilador de prueba.
4. Confirmar el resultado de la operación.
5. Consultar la colección `auditoria`.

**Resultado esperado:**

- El comando se procesa de acuerdo con el comportamiento del sistema.
- Se registra un evento `comando_ventilador`.
- El evento identifica al usuario y al ventilador afectado.
- El detalle identifica la acción realizada sin almacenar información sensible.

**Estado:** Pendiente.

### PA-007: guardar una regla de automatización

**Objetivo:** verificar que guardar una regla genere un evento de auditoría.

**Procedimiento:**

1. Iniciar sesión con un rol autorizado.
2. Crear o modificar una regla de automatización de prueba.
3. Guardar la regla.
4. Consultar `auditoria`.

**Resultado esperado:**

- La regla se guarda correctamente.
- Se registra un evento `regla_automatizacion_modificada`.
- El evento identifica al usuario responsable y la regla afectada.
- Si la regla y el evento se escriben mediante un mismo batch, ambos cambios se confirman de forma atómica.

**Estado:** Pendiente.

### PA-008: modificación de umbral

**Objetivo:** comprobar que cambiar un umbral genere un evento.

**Procedimiento:**

1. Iniciar sesión con un usuario autorizado para modificar umbrales.
2. Seleccionar un umbral de prueba.
3. Cambiar su valor por otro permitido.
4. Guardar el cambio.
5. Consultar los registros de auditoría.

**Resultado esperado:**

- El umbral se actualiza correctamente.
- Se registra el evento `umbral_modificado`.
- El evento identifica al usuario que realizó el cambio.
- El detalle no contiene información sensible.

**Estado:** Pendiente.

### PA-009: reconocimiento de alerta

**Objetivo:** comprobar que reconocer una alerta genere un evento de auditoría.

**Procedimiento:**

1. Iniciar sesión con un usuario autorizado.
2. Abrir una alerta pendiente de reconocimiento.
3. Ejecutar la acción de reconocimiento.
4. Verificar el estado actualizado de la alerta.
5. Consultar `auditoria`.

**Resultado esperado:**

- La alerta queda reconocida.
- Se registra un evento `alerta_reconocida`.
- `usuarioId` corresponde al usuario que reconoció la alerta.
- El evento identifica la alerta afectada.

**Estado:** Pendiente.

### PA-010: resolución automática con usuario `sistema`

**Objetivo:** verificar que una resolución automática quede registrada sin atribuirla incorrectamente a una persona.

**Procedimiento:**

1. Preparar una alerta de prueba que pueda resolverse mediante el mecanismo automático del sistema.
2. Activar el flujo automático en el entorno de pruebas.
3. Esperar a que se cumpla la condición de resolución.
4. Confirmar que la alerta cambie al estado resuelto.
5. Consultar la colección `auditoria`.

**Resultado esperado:**

- La alerta se resuelve automáticamente.
- Se registra un evento `alerta_resuelta`.
- El campo `usuarioId` contiene el valor `sistema`.
- El detalle permite identificar la resolución automática.
- No se atribuye la acción a un usuario humano que no la ejecutó.

**Estado:** Pendiente.

## 7. Seguridad y protección de datos

### PA-011: una acción rechazada por rol no genera evento

**Objetivo:** verificar que las operaciones rechazadas por falta de permisos no creen eventos de auditoría que indiquen una modificación exitosa.

**Procedimiento:**

1. Iniciar sesión con un usuario que no tenga permiso para realizar una acción administrativa.
2. Intentar ejecutar una operación restringida, como modificar un usuario o cambiar un umbral.
3. Confirmar que la operación sea rechazada.
4. Consultar `auditoria` mediante una cuenta autorizada.
5. Comprobar que no exista un evento de éxito asociado a la operación rechazada.

**Resultado esperado:**

- La operación no autorizada es rechazada.
- No se modifica la entidad protegida.
- No se genera un evento que presente la operación como exitosa.
- Si el sistema implementa auditoría de seguridad para intentos rechazados, estos deben registrarse con un tipo diferenciado y sin confundirse con un evento de éxito.

**Estado:** Pendiente.

### PA-012: el detalle no contiene contraseñas

**Objetivo:** comprobar que el campo `detalle` no exponga contraseñas, tokens ni credenciales.

**Procedimiento:**

1. Crear o modificar un usuario de prueba utilizando datos ficticios.
2. Ejecutar una operación que genere un evento de auditoría.
3. Consultar el documento correspondiente.
4. Inspeccionar el campo `detalle`.
5. Verificar que no incluya contraseñas, tokens, secretos, cookies ni credenciales.

**Resultado esperado:**

- El detalle contiene únicamente información necesaria para comprender la operación.
- No se almacenan contraseñas ni tokens.
- Los campos sensibles se excluyen o se redactan antes de escribir el evento.

**Estado:** Pendiente.

### PA-013: el operador no puede entrar a la pantalla de auditoría

**Objetivo:** comprobar que un operador no pueda consultar la interfaz de auditoría.

**Procedimiento:**

1. Iniciar sesión con una cuenta de operador.
2. Intentar acceder a la pantalla de auditoría desde el menú.
3. Intentar acceder directamente mediante la ruta de la pantalla.
4. Verificar el comportamiento de la aplicación.

**Resultado esperado:**

- La pantalla no muestra los registros de auditoría al operador.
- La ruta directa también está protegida.
- El usuario recibe una respuesta apropiada, como acceso denegado o redirección a una página autorizada.
- Ocultar el enlace del menú no es la única medida de seguridad.

**Estado:** Pendiente.

### PA-014: el usuario de consulta no puede entrar a la pantalla de auditoría

**Objetivo:** verificar que el rol de consulta tampoco pueda acceder a la pantalla de auditoría.

**Procedimiento:**

1. Iniciar sesión con una cuenta de consulta.
2. Intentar acceder desde el menú.
3. Probar el acceso directo mediante la ruta de auditoría.
4. Comprobar la respuesta de la aplicación.

**Resultado esperado:**

- La pantalla permanece inaccesible.
- No se muestran registros ni detalles de auditoría.
- La protección funciona aunque se introduzca directamente la URL.

**Estado:** Pendiente.

### PA-015: el operador no puede leer la colección `auditoria`

**Objetivo:** verificar que las reglas de Firestore impidan la lectura directa de auditoría al operador.

**Procedimiento:**

1. Iniciar sesión como operador.
2. Intentar consultar la colección `auditoria` mediante el cliente de Firebase autorizado para esa sesión.
3. Comprobar el resultado de la consulta.
4. Revisar que las reglas desplegadas exijan el rol administrador.

**Resultado esperado:**

- Firestore rechaza la lectura.
- No se entregan documentos de auditoría al operador.
- La restricción se aplica en el servidor mediante reglas de seguridad, no solo en el frontend.

**Estado:** Pendiente.

### PA-016: el usuario de consulta no puede leer la colección `auditoria`

**Objetivo:** verificar que el rol de consulta no pueda leer directamente la colección.

**Procedimiento:**

1. Iniciar sesión con el rol de consulta.
2. Intentar leer `auditoria` mediante el cliente de Firebase.
3. Registrar el resultado de la operación.
4. Confirmar que las reglas exijan el permiso de administrador.

**Resultado esperado:**

- La lectura es rechazada por Firestore.
- Ningún documento de auditoría queda disponible para el usuario de consulta.
- La seguridad no depende exclusivamente de las rutas de navegación.

**Estado:** Pendiente.

## 8. Consulta, filtros y paginación

### PA-017: filtro por tipo de evento

**Objetivo:** comprobar que el filtro permita consultar eventos de un tipo específico.

**Procedimiento:**

1. Iniciar sesión como administrador.
2. Abrir la pantalla de auditoría.
3. Seleccionar un tipo de evento, por ejemplo `comando_ventilador`.
4. Aplicar el filtro.
5. Comparar los resultados con los documentos existentes en Firestore.

**Resultado esperado:**

- Se muestran únicamente los eventos que coinciden con el tipo seleccionado.
- Los eventos no relacionados no aparecen en los resultados filtrados.
- El filtro puede cambiarse o limpiarse correctamente.
- El orden de los registros coincide con el criterio definido por el sistema.

**Estado:** Pendiente.

### PA-018: botón «Cargar más»

**Objetivo:** verificar que la paginación permita consultar más eventos sin repetir registros.

**Procedimiento:**

1. Preparar suficientes eventos de prueba para que exista una segunda página.
2. Abrir la pantalla de auditoría como administrador.
3. Registrar los eventos iniciales visibles.
4. Pulsar «Cargar más».
5. Comparar los nuevos resultados con los ya mostrados.
6. Repetir hasta llegar al final de los registros disponibles.

**Resultado esperado:**

- Se incorporan eventos adicionales.
- Los registros anteriores no se duplican en la interfaz.
- El orden se mantiene consistente.
- El botón deja de ofrecer más resultados cuando se alcanza el final.
- Si hay un filtro activo, la paginación respeta ese filtro.

**Estado:** Pendiente.

## 9. Idempotencia y reintentos de triggers

### PA-019: un reintento de trigger no duplica el evento

**Objetivo:** comprobar que un reintento del mismo evento de origen no genere múltiples registros de auditoría para una única operación lógica.

**Procedimiento:**

1. Preparar una operación de prueba que active el trigger correspondiente.
2. Registrar el identificador del evento de origen y el estado inicial de la colección `auditoria`.
3. Ejecutar la operación.
4. Verificar el evento de auditoría generado.
5. En un entorno de pruebas, provocar o simular un reintento controlado del mismo evento de origen mediante el mecanismo de prueba aprobado para el proyecto.
6. Consultar nuevamente la colección.
7. Comparar los identificadores y la cantidad de registros asociados a la operación.

**Resultado esperado:**

- El evento se registra correctamente en la primera ejecución.
- El reintento no crea un segundo evento para la misma operación lógica.
- El identificador determinista o mecanismo de idempotencia evita duplicados.
- No se eliminan eventos legítimos de otras operaciones.

**Estado:** Pendiente.

**Nota técnica:** Firestore no garantiza por sí solo que un trigger se ejecute una única vez. La función debe implementar una estrategia de idempotencia apropiada, por ejemplo utilizar el identificador del evento de origen como parte de la clave del registro o realizar una escritura condicional/transaccional. La estrategia debe corresponder a la arquitectura real del proyecto.

## 10. Tabla de resultados

Completar esta tabla durante la ejecución.

| Caso | Descripción | Resultado obtenido | Estado | Evidencia |
|---|---|---|---|---|
| PA-001 | Crear usuario | Pendiente | Pendiente | Por registrar |
| PA-002 | Modificar usuario | Pendiente | Pendiente | Por registrar |
| PA-003 | Crear incubadora | Pendiente | Pendiente | Por registrar |
| PA-004 | Modificar incubadora | Pendiente | Pendiente | Por registrar |
| PA-005 | Registrar dispositivo | Pendiente | Pendiente | Por registrar |
| PA-006 | Comando manual | Pendiente | Pendiente | Por registrar |
| PA-007 | Guardar regla de automatización | Pendiente | Pendiente | Por registrar |
| PA-008 | Cambiar umbral | Pendiente | Pendiente | Por registrar |
| PA-009 | Reconocer alerta | Pendiente | Pendiente | Por registrar |
| PA-010 | Resolución automática por `sistema` | Pendiente | Pendiente | Por registrar |
| PA-011 | Acción rechazada no genera evento de éxito | Pendiente | Pendiente | Por registrar |
| PA-012 | Detalle sin contraseñas ni secretos | Pendiente | Pendiente | Por registrar |
| PA-013 | Operador sin acceso a la pantalla | Pendiente | Pendiente | Por registrar |
| PA-014 | Consulta sin acceso a la pantalla | Pendiente | Pendiente | Por registrar |
| PA-015 | Operador sin lectura de Firestore | Pendiente | Pendiente | Por registrar |
| PA-016 | Consulta sin lectura de Firestore | Pendiente | Pendiente | Por registrar |
| PA-017 | Filtro por tipo de evento | Pendiente | Pendiente | Por registrar |
| PA-018 | Paginación «Cargar más» | Pendiente | Pendiente | Por registrar |
| PA-019 | Reintento sin duplicación | Pendiente | Pendiente | Por registrar |

Estados permitidos: **Aprobado**, **Fallido**, **Bloqueado** o **Pendiente**.

## 11. Evidencias recomendadas

Guardar las evidencias en una carpeta como:

`docs/pruebas/evidencias/auditoria/`

Ejemplos de nombres:

- `PA-001-creacion-usuario.png`
- `PA-006-comando-ventilador.png`
- `PA-010-resolucion-sistema.png`
- `PA-012-detalle-sin-secretos.png`
- `PA-015-denegacion-lectura-operador.png`
- `PA-017-filtro-tipo.png`
- `PA-018-cargar-mas.png`
- `PA-019-reintento-trigger.png`

Las capturas deben complementarse con identificadores de documentos, resultados de consultas o registros de ejecución cuando sea necesario. Nunca incluir credenciales reales en las evidencias.

## 12. Criterios de aceptación finales

El módulo de auditoría se considerará aprobado cuando:

- [ ] Todas las operaciones exitosas contempladas generen el evento correspondiente.
- [ ] Los eventos identifiquen correctamente al usuario o a `sistema`.
- [ ] Las operaciones rechazadas no se registren como exitosas.
- [ ] El detalle no incluya contraseñas ni datos sensibles.
- [ ] Los roles operador y consulta no puedan acceder a la pantalla ni leer la colección.
- [ ] El filtro por tipo funcione correctamente.
- [ ] «Cargar más» funcione sin duplicar registros en la interfaz.
- [ ] Los reintentos de triggers no generen eventos duplicados para la misma operación lógica.
- [ ] Las pruebas ejecutadas tengan resultados y evidencias registrados.
- [ ] No queden fallos críticos sin resolver o documentar.

## 13. Resumen de ejecución

- **Fecha de ejecución:** Pendiente.
- **Responsable:** Pendiente.
- **Casos aprobados:** Pendiente.
- **Casos fallidos:** Pendiente.
- **Casos bloqueados:** Pendiente.
- **Incidencias abiertas:** Pendiente.
- **Resultado final:** Pendiente de ejecución.

**Conclusión:** este plan permite comprobar la integridad, seguridad, trazabilidad y consulta de los eventos de auditoría. El módulo solo debe considerarse aprobado después de ejecutar los casos y registrar los resultados reales.
