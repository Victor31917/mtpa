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

**Entrega at-least-once.** El comando viaja con QoS 1, que garantiza al menos
una entrega: el mismo comando puede llegar más de una vez (por ejemplo, la
librería cliente MQTT reenvía un paquete en vuelo al reconectar) y, tras una
caída del broker o del servicio, puede llegar tarde. Por eso el dispositivo
debe:

- ser **idempotente por `ordenId`**: no volver a ejecutar un comando cuyo
  `ordenId` ya procesó;
- **descartar los comandos cuyo `solicitadoEn` tenga más de ~60 s** de
  antigüedad (el mismo máximo que aplica el servicio a las órdenes pendientes,
  `ORDEN_MAX_ANTIGUEDAD_SEGUNDOS`).

## Payload del estado del ventilador

El ventilador publica en `mtpa/{incubadoraId}/ventiladores/{dispositivoId}/estado`
un objeto JSON con esta forma (es lo que publica el simulador):

```json
{
  "incubadoraId": "incubadora-1",
  "dispositivoId": "ventilador-1",
  "encendido": true,
  "velocidad": 50,
  "actualizadoEn": "2026-10-01T15:04:06.000Z"
}
```

| Campo           | Tipo      | Descripción                                                                 |
| --------------- | --------- | ------------------------------------------------------------------------------ |
| `incubadoraId`  | `string`  | Debe coincidir con la del tópico. Si falta se usa la del tópico; si es distinta, el mensaje se descarta. |
| `dispositivoId` | `string`  | Debe coincidir con el del tópico (que es el id del ventilador). Mismas reglas que `incubadoraId`. |
| `encendido`     | `boolean` | **Obligatorio.** `true` → `estadoActual: "encendido"`, `false` → `"apagado"` (`FAN_STATUS`). Cualquier otro tipo descarta el mensaje. |
| `velocidad`     | `number`  | Velocidad reportada (0 a 100). Por ahora el servicio no la guarda.            |
| `actualizadoEn` | `string`  | Fecha del reporte según el dispositivo (ISO 8601, UTC). El servicio no la usa: escribe su propio server timestamp. |

El mensaje **no** incluye `ordenId`. Si el payload no es válido (ver arriba), el
servicio descarta el mensaje y lo registra en el log; un fallo al procesarlo no
afecta al resto de los mensajes (mediciones y latidos).

### Qué hace el servicio al recibirlo

1. Toma `incubadoraId` y `dispositivoId` del tópico. El id del ventilador es el
   `dispositivoId`.
2. Actualiza `ventiladores/{dispositivoId}` (`estadoActual` y `actualizadoEn`).
   Si el documento no existe, o pertenece a otra incubadora que la del tópico, lo
   registra en el log y **no** lo crea (lo crea `crearDispositivo`).
3. Busca la orden en curso del ventilador (ver más abajo) y, si el estado
   reportado es el que pedía, la marca `ejecutada` y guarda `ejecutadaEn`.

Si el ventilador no tiene ninguna orden `enviada` (por ejemplo, un reporte
espontáneo al arrancar el dispositivo), solo se actualiza `estadoActual`.

Los mensajes de estado de un mismo ventilador se procesan **de a uno, en el
orden en que llegaron**: un reporte lento de escribir no puede pisar a uno
posterior. Ventiladores distintos se procesan en paralelo. Este orden vale **por
instancia** del servicio, no entre instancias: dos instancias corriendo a la
vez no se coordinan entre sí. Tampoco hay un tiempo máximo por mensaje: si una
escritura a Firestore queda colgada, los reportes posteriores de ese ventilador
esperan detrás de ella (límite conocido).

## Confirmación de las órdenes

El estado final de una orden cumplida es **`ejecutada`** (`COMMAND_STATUS.EXECUTED`
en el frontend); no existe un estado "confirmada". El flujo completo es
`pendiente` → `enviando` → `enviada` → `ejecutada`, con `fallida` y `expirada`
como finales alternativos (ver `docs/modelo-datos.md`).

### Secuencia de estados al enviar un comando

1. `pendiente` → `enviando`: el servicio reclama la orden (transacción).
2. `enviando` → `enviada` (con `enviadaEn`): **se escribe antes de publicar**, en
   una transacción que exige que la orden siga `enviando`. Así, si el
   dispositivo responde de inmediato, su estado ya encuentra la orden en
   `enviada`. Por eso `enviada` significa "el servicio ya la reclamó y está por
   publicar el comando, o ya lo publicó"; **no garantiza que se haya entregado**.
3. Se publica el comando, comprobando justo antes que el cliente MQTT siga
   conectado (la escritura del paso 2 puede tardar y la conexión caerse en el
   ínterin; un `publish` QoS 1 sin conexión no falla: la librería guarda el
   paquete y lo entrega al reconectar, sin vencimiento). Si ya no hay conexión,
   no se publica y `enviada` → `fallida` (transacción, motivo "Se perdió la
   conexión con el broker antes de publicar el comando"). Si la publicación
   falla, también `enviada` → `fallida` (transacción, con el motivo en `error`).
4. Cuando el dispositivo reporta el estado pedido, `enviada` → `ejecutada`.

Si la escritura del paso 2 falla, el comando no se publica y la orden pasa a
`fallida`. Si el proceso se cae entre los pasos 2 y 3, la orden queda `enviada`
sin haberse publicado y el barrido (ver más abajo) la marca `fallida`. **El
servicio no vuelve a publicar una orden** ni la reintenta automáticamente; esto
no impide que la librería cliente MQTT reenvíe al reconectar un paquete QoS 1
que ya estaba en vuelo (ver "Entrega at-least-once" arriba).

Casos que quedan fuera de lo anterior:

- **Órdenes `enviando` huérfanas.** Si el proceso muere entre el reclamo
  (paso 1) y la escritura de `enviada`, o si Firestore tampoco permite marcarla
  `fallida` tras un fallo del paso 2, la orden queda `enviando`. El barrido solo
  mira las `enviada`, así que no la cierra: requiere revisión manual (límite
  conocido). Si en cambio MQTT está caído al momento de reclamar, la orden no se
  toca (sigue `pendiente`) o, si la conexión cae durante el reclamo, vuelve
  `enviando` → `pendiente` y se revisa de nuevo al reconectar.
- **Reporte espontáneo en la ventana previa a la publicación.** Entre el paso 2
  y el paso 3 la orden ya figura `enviada` aunque todavía no se publicó. Un
  reporte espontáneo que coincida con su acción en esa ventana estrecha la cierra
  como `ejecutada`; si luego la publicación falla, la orden queda `ejecutada` sin
  haberse enviado (la transición a `fallida` exige que siga `enviada`).

### Correlación por "la más reciente en `enviada` que coincide"

Como el estado no trae `ordenId`, el servicio mira las **10 órdenes más
recientes del ventilador** (consulta por `ventiladorId` ordenada por `creadaEn`
descendente; el estado y la acción se filtran en memoria) y, de las que están en
`enviada`, toma la **más reciente cuya acción coincide con el estado
reportado**: `encender` ↔ `encendido`, `apagar` ↔ `apagado`. Esa orden pasa a
`ejecutada`; las demás siguen `enviada`. Si ninguna coincide, no se cierra
ninguna (y `estadoActual` se actualiza igual).

Un reporte espontáneo del dispositivo (por ejemplo, al arrancar) que coincida
con una orden `enviada` la cierra como `ejecutada` aunque no pruebe que fue la
respuesta a ese comando.

**Limitación.** Con varias órdenes en vuelo para el mismo ventilador y la misma
acción, un estado puede cerrar una que no es la que lo provocó; una orden fuera
de las últimas 10 no se correlaciona. **Alternativa más robusta:**
que el dispositivo repita en el mensaje de estado el `ordenId` recibido en el
comando. Eso exige cambiar este contrato, el simulador
(`iot-integration-service/simulator/simulador.js`) y la correlación del servicio;
para esta versión se mantiene la correlación por "la más reciente".

### Timeout: órdenes que nadie confirma

Un barrido periódico dentro del servicio (uno al arrancar y luego uno cada 10
segundos, con una sola consulta `estado == "enviada"`) marca `fallida` toda
orden `enviada` cuyo `enviadaEn` tenga más antigüedad que el timeout, con el
motivo en `error`. Si falta `enviadaEn`, se usa `actualizadaEn` y luego
`creadaEn`; una orden `enviada` sin ninguna de las tres fechas no se puede
datar y **nunca se barre** (no debería ocurrir: el servicio siempre escribe
`enviadaEn`). Al no depender de un temporizador por orden, también cierra las
órdenes que quedaron `enviada` si el servicio se reinició. `estadoActual` no se
modifica al vencer una orden.

- **Variable de entorno:** `ORDEN_CONFIRMACION_TIMEOUT_SEGUNDOS` (por defecto
  **30**; un valor inválido se reemplaza por el defecto). El barrido corre cada
  10 segundos, por lo que una orden puede tardar hasta ese margen más en
  marcarse.
- **Carreras.** Tanto `ejecutada` como `fallida` se escriben en una transacción
  que exige que la orden siga `enviada`: gana quien llegue primero y el otro no
  pisa el resultado.
- **Confirmación tardía.** Una orden que ya venció (`fallida`) no se reabre si el
  dispositivo confirma después; solo se actualiza `estadoActual`.
- **Relojes.** La antigüedad se calcula con el reloj del servicio contra
  `enviadaEn`, que es un timestamp del servidor de Firestore. Si los relojes
  difieren, el vencimiento se corre en esa diferencia. No se corrige.

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
  caído no se detecta ninguna desconexión ni se crea ninguna alerta.
- **Fallo al crear la alerta.** Si la escritura de la alerta falla (por
  ejemplo, un error transitorio de Firestore), el estado `"desconectado"` ya
  escrito se mantiene y el watchdog reintenta crear la alerta en cada ciclo
  mientras el dispositivo siga desconectado, de a un intento por vez y
  comprobando de nuevo que no exista ya una abierta. El fallo se registra en el
  log una sola vez. Si el dispositivo vuelve a comunicarse antes de que la
  alerta se cree, esa caída queda sin alerta (ya no tiene sentido avisar de
  ella); la próxima caída avisa con normalidad.

## Notas

- Los payloads del comando y del estado del ventilador están definidos arriba.
  El payload exacto de los demás mensajes (formato JSON, campos) se
  especificará junto con la implementación del Servicio de Integración IoT en
  el Sprint 2. Este documento fija la convención de nombres de tópicos, los
  payloads del comando y del estado del ventilador, la confirmación de las
  órdenes y la regla de desconexión, que ya forman parte del contrato entre
  dispositivos y backend.
- Ningún cliente del frontend web publica ni se suscribe a estos tópicos
  directamente; el frontend solo lee el estado ya reflejado en Firestore.
