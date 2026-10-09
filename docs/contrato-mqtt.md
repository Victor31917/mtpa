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
`LATIDO_REVISION_SEGUNDOS`, `LATIDO_REFRESCO_SEGUNDOS` y
`LATIDO_ESTABILIDAD_SEGUNDOS` (ver
`iot-integration-service/.env.example`). La detección corre dentro del Servicio
de Integración IoT, por lo que debe estar en ejecución para que funcione: si el
servicio está caído, nadie marca a los dispositivos como desconectados. Los
dispositivos que no existen en `dispositivos/` se ignoran (no se crean).

### Alerta de desconexión

Cuando el servicio marca a un dispositivo como `"desconectado"` también crea
una alerta en `alertas` (`tipo: "dispositivo_desconectado"`, estado `activa`;
ver `docs/modelo-datos.md`), para que alguien se entere de que el dispositivo
dejó de comunicarse. Al crearse, la Cloud Function `notificarAlerta` envía el
correo a los administradores y la interfaz muestra la alerta como cualquier
otra.

- **Sin duplicados.** Antes de crearla, el servicio comprueba si el dispositivo
  ya tiene una alerta de desconexión abierta (`activa` o `reconocida`); si la
  tiene, no crea otra. Si no conoce la incubadora del dispositivo (la toma del
  tópico de sus latidos y mediciones, o del documento `dispositivos/` al
  arrancar), no crea la alerta y lo registra una vez en el log.
- **Resolución por reconexión estable.** Cuando el dispositivo vuelve a
  comunicarse se marca `"conectado"` de inmediato, pero la alerta no se
  resuelve hasta que lleva **60 segundos** conectado sin cortes
  (`LATIDO_ESTABILIDAD_SEGUNDOS`). La comprobación la hace el watchdog, no cada
  latido, y marca la alerta como `resuelta` (`resueltaPor: "sistema"`). La
  estabilidad se mide con las señales realmente recibidas (entre la primera
  señal tras la caída y la última recibida), no con el reloj: los 30 segundos
  que el dispositivo sigue figurando `"conectado"` tras su última señal no
  cuentan. Por eso la alerta se resuelve con la primera señal que cumple la
  ventana, y puede tardar hasta un período de latido más que los 60 segundos
  configurados (con latidos cada 8 s, alrededor de 64 s). Así, un dispositivo
  con conexión intermitente mantiene una sola alerta abierta y no genera un
  correo por cada corte. Si vuelve a caerse antes de ese tiempo, la alerta
  sigue abierta y no se crea otra.
- **Reinicio del servicio.** Las alertas que quedaron abiertas mientras el
  servicio estaba apagado se resuelven del mismo modo cuando el dispositivo
  envía señales durante 60 segundos tras el arranque.
- **Limitación.** Como la detección corre dentro del servicio, si este está
  caído no se detecta ninguna desconexión ni se crea ninguna alerta. Si falla
  la escritura de la alerta, solo se registra en el log: el estado
  `"desconectado"` ya escrito se mantiene y la alerta no se reintenta.

## Notas

- El payload del comando de ventilador está definido arriba. El payload
  exacto de los demás mensajes (formato JSON, campos) se especificará junto
  con la implementación del Servicio de Integración IoT en el Sprint 2. Este
  documento fija la convención de nombres de tópicos, el payload del comando
  y la regla de desconexión, que ya forman parte del contrato entre
  dispositivos y backend.
- Ningún cliente del frontend web publica ni se suscribe a estos tópicos
  directamente; el frontend solo lee el estado ya reflejado en Firestore.
