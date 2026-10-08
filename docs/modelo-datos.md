# Modelo de datos — Firestore

Este documento describe las colecciones de Firestore usadas por M.T.P.A. Los
nombres de colección están centralizados en
`frontend/src/utils/constants.js` (`COLLECTIONS`).

## `usuarios/{uid}`

Representa a cada usuario del sistema. El identificador del documento (`uid`)
es el mismo `uid` asignado por Firebase Authentication.

| Campo      | Tipo                                             | Descripción                                                        |
| ---------- | ------------------------------------------------- | ------------------------------------------------------------------- |
| `uid`      | `string`                                          | Identificador de Firebase Authentication (duplicado como campo para facilitar queries). |
| `nombre`   | `string`                                          | Nombre completo del usuario.                                       |
| `correo`   | `string`                                          | Correo electrónico (debe coincidir con el de Authentication).       |
| `rol`      | `string` (`"administrador"` \| `"operador"` \| `"consulta"`) | Rol del usuario. Se replica como custom claim `role` en el token.   |
| `activo`   | `boolean`                                         | Si es `false`, el usuario no debe poder operar el sistema aunque su cuenta de Authentication siga habilitada. |
| `creadoEn` | `timestamp`                                       | Fecha de creación del documento (server timestamp).                 |

Reglas de acceso (ver `firestore.rules`): lectura permitida al propio usuario
o a un administrador; escritura exclusiva de administradores, y siempre a
través de la Cloud Function `gestionarUsuario` (nunca por escritura directa
desde el cliente).

## `incubadoras/{incubadoraId}` (Sprint 2)

Representa una incubadora física monitoreada.

| Campo        | Tipo     | Descripción                                                  |
| ------------ | -------- | -------------------------------------------------------------- |
| `id`         | `string` | Identificador de la incubadora (igual al id del documento).     |
| `nombre`     | `string` | Nombre visible de la incubadora.                                |
| `ubicacion`  | `string` | Ubicación física (galpón, sector, etc.).                        |
| `estado`     | `string` | Uno de los valores de `INCUBATOR_STATUS` (`activa`, `inactiva`, `advertencia`, `critica`, `mantenimiento`). |

## `dispositivos/{dispositivoId}` (Sprint 2)

Representa un dispositivo físico (sensor o ventilador) asociado a una
incubadora.

| Campo                  | Tipo        | Descripción                                                                 |
| ---------------------- | ----------- | ------------------------------------------------------------------------------ |
| `incubadoraId`         | `string`    | Referencia a la incubadora dueña del dispositivo (`incubadoras/{id}`).          |
| `tipo`                 | `string`    | Uno de los valores de `DEVICE_TYPES` (`sensor_temperatura`, `sensor_humedad`, `sensor_temperatura_humedad`, `ventilador`, `controlador`). |
| `identificadorMqtt`    | `string`    | Identificador único del dispositivo usado en los tópicos MQTT (ver `docs/contrato-mqtt.md`). |
| `estadoConexion`       | `string`    | Uno de los valores de `DEVICE_STATUS` (`conectado`, `desconectado`, `advertencia`, `desconocido`). |
| `ultimaComunicacionEn` | `timestamp` | Última vez que el dispositivo envió un latido o una medición. Se usa para derivar `estadoConexion` (ver contrato MQTT: sin latido en más de 30s ⇒ `desconectado`). |

## `ventiladores/{ventiladorId}` (Sprint 4)

Representa un ventilador de una incubadora. Es el documento que lee la Cloud
Function `enviarComandoVentilador` antes de crear una orden. Ningún cliente lo
escribe (ver `firestore.rules`): el estado lo actualiza el Servicio de
Integración IoT con Admin SDK.

| Campo          | Tipo     | Descripción                                                                 |
| -------------- | -------- | ------------------------------------------------------------------------------ |
| `incubadoraId` | `string` | Incubadora a la que pertenece (`incubadoras/{id}`). Se copia a cada orden.      |
| `dispositivoId`| `string` | Dispositivo físico asociado (`dispositivos/{id}`, tipo `ventilador`). Junto con `incubadoraId` arma el tópico MQTT del comando (ver `docs/contrato-mqtt.md`). Se copia a cada orden. |
| `modoControl`  | `string` | Uno de los valores de `FAN_CONTROL_MODE` (`manual`, `automatico`, `mixto`). `enviarComandoVentilador` solo acepta comandos manuales en `manual` y `mixto`. |
| `estadoActual` | `string` | Uno de los valores de `FAN_STATUS` (`encendido`, `apagado`). Lo actualiza el Servicio de Integración al recibir la confirmación del dispositivo. |

## `ordenes_ventilador/{ordenId}` (Sprint 4)

Cada orden es una solicitud de encender o apagar un ventilador. La crea la
Cloud Function `enviarComandoVentilador` con estado `pendiente`; el Servicio
de Integración IoT la toma, publica el comando MQTT y actualiza su estado. El
cliente solo puede leerlas (ver `firestore.rules`).

| Campo              | Tipo        | Descripción                                                                 |
| ------------------ | ----------- | ------------------------------------------------------------------------------ |
| `ventiladorId`     | `string`    | Ventilador destino (`ventiladores/{id}`).                                       |
| `incubadoraId`     | `string`    | Copiado de `ventiladores/{ventiladorId}`; el Servicio de Integración lo usa para el tópico MQTT. |
| `dispositivoId`    | `string`    | Copiado de `ventiladores/{ventiladorId}`; el Servicio de Integración lo usa para el tópico MQTT. |
| `accionSolicitada` | `string`    | `encender` o `apagar` (`FAN_ACTIONS.TURN_ON` / `FAN_ACTIONS.TURN_OFF`).         |
| `origen`           | `string`    | Quién generó la orden. `manual` cuando la crea `enviarComandoVentilador`.       |
| `estado`           | `string`    | Estado de la orden (ver tabla de abajo).                                        |
| `solicitadoPor`    | `string`    | `uid` del usuario que envió el comando.                                         |
| `creadaEn`         | `timestamp` | Fecha de creación (server timestamp). El Servicio de Integración descarta las órdenes pendientes demasiado antiguas. |
| `enviadaEn`        | `timestamp` | Momento en que el comando se publicó en MQTT (lo escribe el Servicio de Integración). |
| `actualizadaEn`    | `timestamp` | Último cambio de `estado` hecho por el Servicio de Integración.                 |
| `error`            | `string`    | Motivo, cuando el estado es `fallida` o `expirada`.                             |

### Estados de una orden

Vocabulario basado en `COMMAND_STATUS` (`frontend/src/utils/constants.js`),
ampliado con `enviando` y `expirada`, que usa el Servicio de Integración:

| Estado       | Significado                                                                  | Lo escribe |
| ------------ | ------------------------------------------------------------------------------ | ---------- |
| `pendiente`  | Orden creada, todavía no tomada por el Servicio de Integración.                | `enviarComandoVentilador` |
| `enviando`   | El Servicio de Integración tomó la orden (transacción `pendiente` → `enviando`) y está publicando el comando; evita doble publicación. | Servicio de Integración |
| `enviada`    | El comando se publicó en MQTT (`enviadaEn`).                                    | Servicio de Integración |
| `ejecutada`  | El dispositivo confirmó el cambio por `.../estado`. Pendiente de implementar.   | Servicio de Integración (trabajo futuro) |
| `fallida`    | La orden es inválida o no pudo publicarse (ver `error`).                        | Servicio de Integración |
| `expirada`   | Seguía `pendiente` pasado el tiempo máximo (`ORDEN_MAX_ANTIGUEDAD_SEGUNDOS`) y no se envió, para no accionar un ventilador con una orden vieja. | Servicio de Integración |

Flujo normal: `pendiente` → `enviando` → `enviada` → `ejecutada`; las
alternativas finales son `fallida` y `expirada`.

## Notas generales

- Las colecciones `incubadoras`, `dispositivos`, `mediciones`, `umbrales`,
  `alertas`, `ventiladores`, `reglas_automatizacion`, `ordenes_ventilador`,
  `estadisticas_diarias`, `auditoria` y `config_sistema` están enumeradas en
  `COLLECTIONS` para uso futuro (Sprint 2 en adelante); este documento se irá
  completando a medida que se implementen.
- Ninguna de estas colecciones debe recibir escrituras directas desde el
  cliente para datos que representen el estado real del sistema (mediciones,
  alertas, estado de dispositivos): esas escrituras las realiza el Servicio
  de Integración IoT o una Cloud Function, nunca el cliente web.
