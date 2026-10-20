# Plan de pruebas: monitoreo y alertas

## 1. Información general

- **Proyecto:** Sistema de gestión y monitorización de incubadoras.
- **Módulo:** Monitoreo, dispositivos y alertas.
- **Archivo:** `docs/pruebas/plan-pruebas-monitoreo-alertas.md`
- **Fecha de elaboración:** 20/10/2026.
- **Responsable de ejecución:** Equipo de pruebas.
- **Tipo de pruebas:** Integración, tiempo real, notificaciones y detección de desconexión.
- **Estado:** Pendiente de ejecución y registro de evidencias.

## 2. Objetivo

Verificar que el sistema procese correctamente las mediciones recibidas desde el simulador, actualice el panel de monitoreo en tiempo real, genere alertas cuando una medición esté fuera de los umbrales configurados, envíe el correo de notificación, muestre el banner dentro de la aplicación y detecte la desconexión de un dispositivo cuando deje de enviar latidos (*heartbeats*).

## 3. Alcance

La prueba cubrirá el siguiente flujo completo:

1. El simulador publica una medición fuera de rango.
2. La medición se almacena en `mediciones/`.
3. El panel muestra la medición en tiempo real.
4. El sistema genera una alerta.
5. El sistema envía el correo de notificación.
6. El banner de alerta aparece en la aplicación.
7. El simulador deja de enviar latidos.
8. El sistema marca el dispositivo como **desconectado dentro de los 30 segundos esperados**.

La prueba debe ejecutarse en un entorno controlado, con una incubadora de prueba, un dispositivo registrado y umbrales configurados previamente.

## 4. Precondiciones

Antes de iniciar, verificar lo siguiente:

- [ ] El frontend está funcionando y el usuario ha iniciado sesión.
- [ ] Firebase y Firestore están configurados correctamente.
- [ ] El simulador está conectado al entorno de pruebas.
- [ ] Existe una incubadora registrada.
- [ ] Existe un dispositivo asociado a la incubadora.
- [ ] La recepción y persistencia de mediciones están habilitadas.
- [ ] Los umbrales de temperatura o humedad están configurados para permitir una prueba fuera de rango.
- [ ] La generación de alertas está habilitada.
- [ ] El servicio de envío de correos está configurado.
- [ ] El usuario o destinatario de prueba puede recibir correos.
- [ ] El mecanismo de recepción de latidos y detección de desconexión está activo.
- [ ] Se puede consultar el estado del dispositivo en Firestore o desde el panel.
- [ ] Se dispone de acceso a los registros de ejecución para investigar errores.

**Importante:** registrar los valores reales de los umbrales, el intervalo normal de envío de latidos y la configuración de desconexión antes de ejecutar las pruebas.

## 5. Datos de prueba

| Dato | Valor de prueba |
|---|---|
| ID de incubadora | `incubadora_prueba` |
| ID de dispositivo | `dispositivo_prueba` |
| Variable a probar | `temperatura` |
| Umbral mínimo | Completar con el valor configurado |
| Umbral máximo | Completar con el valor configurado |
| Medición fuera de rango | Valor superior al umbral máximo |
| Destinatario del correo | Cuenta de prueba autorizada |
| Tiempo esperado de desconexión | Máximo 30 segundos, según el requisito |
| Fecha y hora de ejecución | Completar durante la prueba |

Los identificadores y valores anteriores son ejemplos. Deben sustituirse por los existentes en el entorno de pruebas. La medición de prueba debe estar fuera del umbral real configurado.

## 6. Casos de prueba

### CP-MA-001: publicación de medición fuera de rango

**Objetivo:** comprobar que el simulador publica una medición que supera el umbral establecido.

**Procedimiento:**

1. Iniciar el simulador.
2. Confirmar que el dispositivo está conectado.
3. Consultar el umbral máximo de temperatura.
4. Configurar el simulador para publicar una temperatura superior a ese umbral.
5. Enviar la medición.
6. Revisar los registros del simulador y la respuesta del sistema.

**Resultado esperado:**

- El simulador publica la medición correctamente.
- La medición corresponde al dispositivo y a la incubadora de prueba.
- El sistema recibe el dato sin errores.

**Resultado obtenido:** Pendiente.

**Estado:** Pendiente de ejecución.

### CP-MA-002: persistencia en Firestore

**Objetivo:** verificar que la medición publicada se almacene en la colección `mediciones/`.

**Procedimiento:**

1. Ejecutar el caso CP-MA-001.
2. Abrir Firestore.
3. Consultar la colección `mediciones`.
4. Buscar el registro correspondiente al dispositivo, la incubadora y la hora de publicación.
5. Verificar la variable, el valor y la fecha de medición.

**Resultado esperado:**

- Existe un documento para la medición recibida.
- El valor coincide con el publicado por el simulador.
- La fecha y los identificadores corresponden a la prueba.

**Estado:** Pendiente de ejecución.

### CP-MA-003: actualización del panel en tiempo real

**Objetivo:** comprobar que el panel muestre la nueva medición sin necesidad de recargar manualmente la página.

**Procedimiento:**

1. Abrir el panel de monitoreo de la incubadora.
2. Registrar la hora de inicio de la prueba.
3. Publicar una medición desde el simulador.
4. Observar el panel.
5. Comparar el valor y la hora mostrados con el documento de Firestore.

**Resultado esperado:**

- La nueva medición aparece automáticamente.
- El valor mostrado coincide con el almacenado.
- La interfaz no necesita una recarga manual.
- La medición aparece asociada a la incubadora correcta.

**Evidencia sugerida:** captura de pantalla del panel y registro de la medición en Firestore.

**Estado:** Pendiente de ejecución.

### CP-MA-004: generación de alerta por valor fuera de rango

**Objetivo:** verificar que una medición que supera el umbral genere una alerta.

**Procedimiento:**

1. Confirmar los umbrales configurados.
2. Publicar una medición fuera de rango.
3. Consultar la colección `alertas`.
4. Buscar una alerta asociada a la incubadora, al dispositivo y a la variable probada.
5. Verificar el motivo, el valor y la fecha de generación.

**Resultado esperado:**

- Se genera una alerta relacionada con la medición.
- La alerta identifica la variable y el valor que incumple el umbral.
- La alerta queda disponible para ser consultada desde la aplicación.
- No se generan alertas duplicadas inesperadas para un mismo evento, de acuerdo con las reglas del sistema.

**Estado:** Pendiente de ejecución.

### CP-MA-005: envío de correo electrónico

**Objetivo:** comprobar que la alerta genere el envío de un correo al destinatario configurado.

**Procedimiento:**

1. Verificar que el destinatario de prueba esté configurado.
2. Publicar una medición fuera de rango.
3. Confirmar que se haya generado la alerta.
4. Consultar los registros de la función o del servicio responsable del envío.
5. Revisar la bandeja de entrada del destinatario y, si corresponde, la carpeta de correo no deseado.
6. Comparar el contenido del correo con la alerta generada.

**Resultado esperado:**

- El servicio procesa el envío del correo sin errores.
- El correo llega al destinatario de prueba.
- El contenido permite identificar la alerta y la variable afectada.
- La notificación corresponde a la medición que originó la alerta.

**Nota:** distinguir entre un correo aceptado por el proveedor y un correo efectivamente recibido. Registrar ambos resultados cuando existan evidencias.

**Estado:** Pendiente de ejecución.

### CP-MA-006: aparición del banner de alerta en la aplicación

**Objetivo:** comprobar que la alerta se muestre mediante el banner de la interfaz.

**Procedimiento:**

1. Iniciar sesión en la aplicación.
2. Abrir el panel correspondiente a la incubadora.
3. Publicar una medición fuera de rango.
4. Observar la interfaz sin recargar la página.
5. Comparar el banner con el registro de alerta en Firestore.

**Resultado esperado:**

- El banner aparece cuando se recibe la alerta.
- La información mostrada coincide con la alerta generada.
- El banner identifica claramente la condición detectada.
- La interfaz se actualiza en tiempo real según el mecanismo implementado.

**Estado:** Pendiente de ejecución.

### CP-MA-007: detección de desconexión por ausencia de latidos

**Objetivo:** comprobar que el dispositivo se marque como desconectado cuando el simulador deje de enviar latidos.

**Procedimiento:**

1. Iniciar el simulador y confirmar que el dispositivo aparece conectado.
2. Verificar que se estén registrando latidos correctamente.
3. Registrar la hora del último latido recibido.
4. Detener únicamente el envío de latidos del dispositivo de prueba, sin borrar sus datos ni eliminar el registro.
5. Medir el tiempo transcurrido desde el último latido válido.
6. Consultar el estado del dispositivo en Firestore y en el panel.
7. Registrar el tiempo en que cambia a desconectado.

**Resultado esperado:**

- El sistema detecta la ausencia de latidos.
- El dispositivo cambia al estado **desconectado** dentro de los 30 segundos esperados.
- El cambio de estado se refleja en el panel según el mecanismo de actualización implementado.
- El sistema no confunde la falta de latidos con la eliminación del dispositivo.

**Criterio temporal:**

\[
T_{\text{desconexión}} =
T_{\text{detección}} - T_{\text{último latido}}
\]

La prueba cumple el requisito si:

\[
T_{\text{desconexión}} \leq 30 \text{ segundos}
\]

El tiempo debe medirse usando el instante del último latido válido y el instante en que el sistema registra el estado desconectado. También se recomienda registrar por separado el tiempo que tarda el panel en reflejar el cambio.

**Estado:** Pendiente de ejecución.

### CP-MA-008: verificación integral del flujo

**Objetivo:** confirmar que todos los componentes funcionen de manera integrada.

**Procedimiento:**

1. Iniciar el simulador y verificar el estado conectado.
2. Publicar una medición fuera de rango.
3. Confirmar la persistencia en `mediciones/`.
4. Confirmar la actualización del panel en tiempo real.
5. Confirmar la generación de la alerta.
6. Verificar la recepción del correo.
7. Verificar la aparición del banner.
8. Detener el envío de latidos.
9. Confirmar que el dispositivo se marque como desconectado en un máximo de 30 segundos.
10. Guardar las evidencias de cada etapa.

**Resultado esperado:**

Todo el flujo se ejecuta en el orden previsto, sin pérdida de datos ni fallos que impidan completar las notificaciones o la detección de desconexión.

**Estado:** Pendiente de ejecución.

## 7. Registro de resultados

Completar esta tabla durante la ejecución de las pruebas.

| Caso | Resultado esperado | Resultado obtenido | Estado | Evidencia |
|---|---|---|---|---|
| CP-MA-001 | Simulador publica una medición fuera de rango. | Pendiente | Pendiente | Registro del simulador |
| CP-MA-002 | Medición almacenada en Firestore. | Pendiente | Pendiente | Documento de `mediciones` |
| CP-MA-003 | Panel actualizado en tiempo real. | Pendiente | Pendiente | Captura del panel |
| CP-MA-004 | Alerta generada correctamente. | Pendiente | Pendiente | Documento de `alertas` |
| CP-MA-005 | Correo enviado y recibido. | Pendiente | Pendiente | Registro del servicio y correo |
| CP-MA-006 | Banner visible en la aplicación. | Pendiente | Pendiente | Captura de pantalla |
| CP-MA-007 | Dispositivo desconectado en máximo 30 s. | Pendiente | Pendiente | Tiempos y estado del dispositivo |
| CP-MA-008 | Flujo integral completado. | Pendiente | Pendiente | Evidencias de todos los pasos |

Valores permitidos para el estado: **Aprobado**, **Fallido**, **Bloqueado** o **Pendiente**.

## 8. Evidencias que se deben conservar

Para que las pruebas puedan ser revisadas por otro integrante del equipo, guardar:

- Captura o registro de la medición enviada por el simulador.
- Identificador del documento creado en `mediciones`.
- Captura del panel mostrando la medición.
- Identificador y contenido relevante del documento de `alertas`.
- Registro del envío y evidencia de recepción del correo.
- Captura del banner dentro de la aplicación.
- Hora del último latido válido.
- Hora del cambio a desconectado.
- Cálculo del tiempo transcurrido.
- Mensajes de error relevantes, si se presentan.

Las evidencias deben evitar exponer contraseñas, tokens, credenciales u otros datos sensibles.

## 9. Gestión de fallos

Si una prueba falla:

1. Registrar el caso, la hora y el resultado observado.
2. Guardar los registros y capturas disponibles.
3. Identificar la etapa en la que se interrumpió el flujo.
4. Revisar los registros del simulador, Firestore, Cloud Functions y frontend, según corresponda.
5. No marcar la prueba como aprobada hasta repetirla satisfactoriamente.
6. Registrar la corrección aplicada y ejecutar nuevamente el caso afectado.

Si una prueba no puede ejecutarse por falta de configuración o por indisponibilidad de un servicio, marcarla como **Bloqueado** y documentar el motivo.

## 10. Criterios generales de aceptación

El flujo de monitoreo y alertas se considerará aprobado cuando:

- [ ] La medición fuera de rango sea publicada por el simulador.
- [ ] La medición quede almacenada correctamente en `mediciones`.
- [ ] El panel muestre la medición en tiempo real.
- [ ] Se genere la alerta correspondiente.
- [ ] El correo de notificación llegue al destinatario de prueba.
- [ ] El banner aparezca en la aplicación.
- [ ] El dispositivo cambie a desconectado después de dejar de enviar latidos.
- [ ] El cambio a desconectado ocurra dentro de los 30 segundos esperados.
- [ ] Se hayan guardado las evidencias de todas las etapas.
- [ ] No existan fallos críticos sin documentar.

## 11. Cierre de las pruebas

- **Fecha de ejecución:** Pendiente.
- **Ejecutado por:** Pendiente.
- **Casos aprobados:** Pendiente.
- **Casos fallidos:** Pendiente.
- **Casos bloqueados:** Pendiente.
- **Incidencias encontradas:** Pendiente.
- **Resultado final:** Pendiente de ejecución.

**Conclusión:** este plan permite verificar de extremo a extremo la recepción de mediciones, la generación de alertas, las notificaciones y la detección de desconexión. El resultado final deberá completarse con datos y evidencias obtenidos durante la ejecución real.

