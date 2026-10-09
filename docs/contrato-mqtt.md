# Contrato MQTT — M.T.P.A.

Este documento define la convención de tópicos MQTT que usará el Servicio de
Integración IoT (Node.js, Sprint 2) para comunicarse con los dispositivos
físicos de cada incubadora. El cliente web **no** se conecta nunca
directamente al broker MQTT: todo pasa por ese servicio, que traduce los
mensajes en escrituras a Firestore (y viceversa, para los comandos).

## Convención de tópicos

Todos los tópicos usan el prefijo `mtpa/` seguido del identificador de la
incubadora (`incubadoraId`) y del identificador del dispositivo
(`dispositivoId`), ambos coincidentes con los ids usados en Firestore
(`incubadoras/{incubadoraId}`, `dispositivos/{dispositivoId}`).

| Tópico                                                         | Dirección                | Descripción                                                                 |
| ---------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| `mtpa/{incubadoraId}/sensores/{dispositivoId}/medicion`           | Dispositivo → Servicio   | Publica una nueva medición (temperatura y/o humedad) del sensor.               |
| `mtpa/{incubadoraId}/ventiladores/{dispositivoId}/comando`        | Servicio → Dispositivo   | Envía un comando al ventilador (encender, apagar, establecer velocidad).       |
| `mtpa/{incubadoraId}/ventiladores/{dispositivoId}/estado`         | Dispositivo → Servicio   | El ventilador reporta su estado actual (encendido/apagado, velocidad).         |
| `mtpa/{incubadoraId}/dispositivos/{dispositivoId}/latido`         | Dispositivo → Servicio   | Señal de "estoy vivo" (*heartbeat*) enviada periódicamente por cualquier dispositivo. |

## Payload del comando de ventilador

El Servicio de Integración publica en
`mtpa/{incubadoraId}/ventiladores/{dispositivoId}/comando` (QoS 1) un objeto
JSON con esta forma, a partir de una orden de `ordenes_ventilador` (ver
`docs/modelo-datos.md`):

```json
{
  "accion": "encender",
  "ordenId": "Qm3xYz...",
  "solicitadoEn": "2026-10-01T15:04:05.000Z"
}
```

| Campo          | Tipo     | Descripción                                                                 |
| -------------- | -------- | ------------------------------------------------------------------------------ |
| `accion`       | `string` | `"encender"` o `"apagar"` (`FAN_ACTIONS.TURN_ON` / `FAN_ACTIONS.TURN_OFF`). El dispositivo lee este campo. `"establecer_velocidad"` (con un campo `velocidad` de 0 a 100) está reservada para una etapa posterior. |
| `ordenId`      | `string` | Id de la orden en `ordenes_ventilador`; permite correlacionar la confirmación publicada en `.../estado` con la orden. |
| `solicitadoEn` | `string` | Fecha de creación de la orden (ISO 8601, UTC).                                  |

## Detección de desconexión

Cada dispositivo debe publicar un mensaje en
`mtpa/{incubadoraId}/dispositivos/{dispositivoId}/latido` de forma periódica.
El Servicio de Integración IoT debe marcar el campo `estadoConexion` del
documento `dispositivos/{dispositivoId}` en Firestore como `"desconectado"`
(ver `DEVICE_STATUS.DISCONNECTED` en `frontend/src/utils/constants.js`) si no
se recibe un latido en más de **30 segundos**
(`SYSTEM_INTERVALS.COMMUNICATION_TIMEOUT_SECONDS`).

El campo `ultimaComunicacionEn` (ver `docs/modelo-datos.md`) guarda la última
comunicación registrada del dispositivo: se actualiza al marcarlo
`"conectado"` y, mientras siga conectado, como máximo una vez por minuto. El
umbral de 30 segundos no se calcula con ese campo sino con el registro en
memoria de la última señal (latido o medición) que lleva el servicio. El campo
solo se lee al arrancar, para recuperar los dispositivos que quedaron
`"conectado"` antes de un reinicio, a los que se les da un margen de 30
segundos contado desde el arranque.

Tanto los latidos como las mediciones válidas cuentan como señal de vida del
dispositivo. Para no agotar la cuota de Firestore, el servicio no escribe en
cada mensaje: solo al marcar `"conectado"`, al refrescar
`ultimaComunicacionEn` (como máximo una vez por minuto) y al marcar
`"desconectado"`. Los umbrales se ajustan con `LATIDO_TIMEOUT_SEGUNDOS`,
`LATIDO_REVISION_SEGUNDOS` y `LATIDO_REFRESCO_SEGUNDOS` (ver
`iot-integration-service/.env.example`). La detección corre dentro del Servicio
de Integración IoT, por lo que debe estar en ejecución para que funcione: si el
servicio está caído, nadie marca a los dispositivos como desconectados. Los
dispositivos que no existen en `dispositivos/` se ignoran (no se crean).

## Notas

- El payload del comando de ventilador está definido arriba. El payload
  exacto de los demás mensajes (formato JSON, campos) se especificará junto
  con la implementación del Servicio de Integración IoT en el Sprint 2. Este
  documento fija la convención de nombres de tópicos, el payload del comando
  y la regla de desconexión, que ya forman parte del contrato entre
  dispositivos y backend.
- Ningún cliente del frontend web publica ni se suscribe a estos tópicos
  directamente; el frontend solo lee el estado ya reflejado en Firestore.
