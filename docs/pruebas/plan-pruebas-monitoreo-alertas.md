# Plan de pruebas — Monitoreo, alertas y desconexión (CU-02)

Casos de prueba de extremo a extremo para el caso de uso **CU-02 (monitoreo
ambiental y alertas)** del Sprint 3, usando el simulador de dispositivo
(`iot-integration-service/simulator/simulador.js`) en lugar de hardware real.

El flujo cubierto es:

```
simulador MQTT -> Servicio de Integración IoT -> procesarMedicion (Cloud Function)
  -> mediciones/{id} + dispositivos/{id} (estadoConexion, ultimaComunicacionEn)
  -> evaluarUmbrales -> alertas/{id} (estado "activa")
       (con cada medición también resuelve solo las alertas abiertas cuyo
        valor ya se recuperó: estado "resuelta", ver sección 11)
       -> notificarAlerta -> colección "mail" -> extensión Trigger Email -> correo
       -> banner en la aplicación ("Ver alerta") -> listado /alertas -> detalle /alertas/:id
  -> panel general (/dashboard): tarjetas, estado general y resumen de incubadoras
Configuración de límites (umbrales): /configuracion/limites (solo administrador)
Desconexión: el Servicio de Integración marca el dispositivo "desconectado"
  -> crea alertas/{id} de tipo "dispositivo_desconectado" (estado "activa")
  -> notificarAlerta -> correo, banner, listado y detalle (igual que arriba)
  -> la resuelve solo cuando el dispositivo lleva 60 s conectado sin cortes
     (estado "resuelta", ver sección 9)
```

> **Estado de este plan: Plan documentado; ejecución pendiente (requiere
> Firebase y broker reales).**
>
> Ningún caso de este documento fue ejecutado. Todos requieren un proyecto de
> Firebase real (o su emulador), el broker MQTT (HiveMQ Cloud) y el Servicio
> de Integración en ejecución. Las columnas `Resultado` y `Evidencia` de la
> sección 12 están vacías a propósito: se completan al ejecutar las pruebas.

## 0. Prerrequisitos

### 0.1 Código bajo prueba

- El panel general, las páginas de alertas y la página de límites del Sprint 3
  (ramas `feat/sprint-3-umbrales`, `feat/sprint-3-alertas-paginas` y
  `feat/sprint-3-dashboard-acabado`, o `main` una vez integradas).
- Para la sección 11 (y los casos 2.6, 2.7, 3.3, 9.5 y 9.7): la resolución
  automática de alertas en `evaluarUmbrales` (rama
  `feat/sprint-3-resolucion-alertas`) y el ciclo de vida de alertas en la
  interfaz, es decir, el estado general que cuenta alertas `activa` y
  `reconocida` y el bloque de resolución del detalle (rama
  `feat/sprint-3-alertas-ciclo-de-vida-ui`), o `main` una vez integradas. Sin
  el primer cambio ninguna alerta pasa a `resuelta`.
- Para la sección 9: el Servicio de Integración con detección de desconexión
  (`iot-integration-service/lib/estado-conexion.js`, rama
  `feat/sprint-3-deteccion-desconexion`; al redactar este plan todavía no
  estaba integrada en `main`). Sin ese cambio ningún proceso marca
  dispositivos como `desconectado`.
- Para los casos 9.10 a 9.18 y 11.14: la alerta de desconexión del Servicio de
  Integración (creación sin duplicados y resolución por reconexión estable,
  rama `feat/sprint-3-alerta-desconexion`) y su presentación en la interfaz,
  es decir, el detalle de la alerta sin variable, valor ni límite y con el
  bloque "El dispositivo volvió a comunicarse" (rama
  `feat/sprint-3-alerta-desconexion-ui`), o `main` una vez integradas. Sin el
  primer cambio la desconexión no genera ninguna alerta.

### 0.2 Firebase

| Elemento | Qué debe estar listo |
| -------- | -------------------- |
| Cloud Functions | Desplegadas `procesarMedicion` (HTTPS, con la resolución automática de alertas de `evaluarUmbrales`), `notificarAlerta` (trigger `onCreate` de `alertas/{alertaId}`), `gestionarUsuario`, `gestionarIncubadora` y `crearDispositivo`. `notificarAlerta` también envía el correo de las alertas de desconexión. |
| `INTEGRATION_SERVICE_TOKEN` | Configurado en las Cloud Functions; `procesarMedicion` responde `403` si el token no coincide. Debe ser el mismo valor que `PROCESAR_MEDICION_TOKEN` del Servicio de Integración. |
| Reglas | `firestore.rules` desplegadas: `umbrales` (lectura autenticada, escritura solo administrador) y `alertas` (actualización solo administrador u operador, únicamente el campo `estado`, únicamente hacia `reconocida` o `resuelta`). |
| Índices | `firestore.indexes.json` desplegado. Las consultas de monitoreo (`mediciones`, `alertas`, `umbrales`, `dispositivos`) no necesitan índices compuestos; el único índice declarado es el de `ordenes_ventilador`. Las consultas del Servicio de Integración sobre `alertas` (dispositivo + tipo + estado) usan solo filtros de igualdad, así que tampoco necesitan uno. |
| Extensión Trigger Email | Instalada (`firebase/firestore-send-email`), con la colección de correos `mail`, el servidor SMTP y el remitente por defecto configurados (ver `docs/notificaciones.md`). Sin ella las alertas se crean y se ven en la aplicación, pero no llega ningún correo. |
| Usuarios | Un `administrador` activo con `correo` válido y que pueda leer su bandeja, un `operador` y un usuario de `consulta`, todos activos y con su custom claim `role` correcto (ver `docs/pruebas/plan-pruebas-autenticacion.md` y `docs/bootstrap-admin.md`). |

### 0.3 Datos de prueba

1. Como `administrador`, crear una incubadora activa desde `/incubadoras/nueva`
   ("+ Nueva incubadora"). Anotar su id (aparece en la URL
   `/incubadoras/<id>`).
2. En la edición de esa incubadora (`/incubadoras/<id>/editar`), dar de alta
   un dispositivo `sensor_temperatura` y otro `ventilador` ("+ Agregar
   dispositivo").
3. En la consola de Firebase (Firestore) copiar el **id del documento** de
   cada dispositivo en `dispositivos/`. Es el `dispositivoId` que usan los
   tópicos MQTT y `procesarMedicion`; **no** es el `identificadorMqtt` que
   muestra la pantalla. Con un id que no existe en `dispositivos/`,
   `procesarMedicion` responde `404` ("El dispositivo no existe.") y el
   Servicio de Integración lo registra como error en su log.
4. Opcional, para comprobar el resumen por incubadora: crear una segunda
   incubadora activa con su propio sensor.

### 0.4 Servicio de Integración y simulador

Dentro de `iot-integration-service/` (una sola vez: `npm install`):

- Copiar `.env.example` a `.env` y completar `MQTT_HOST`, `MQTT_PORT`,
  `MQTT_USERNAME`, `MQTT_PASSWORD`, `MQTT_TOPIC_PREFIX` (por defecto
  `mtpa-dev`), `PROCESAR_MEDICION_URL`, `PROCESAR_MEDICION_TOKEN` y
  `GOOGLE_APPLICATION_CREDENTIALS` (ruta al JSON de la cuenta de servicio de
  Firebase, guardado fuera del repositorio). Ver `docs/broker-mqtt.md`.
- Opcionales de la detección de desconexión: `LATIDO_TIMEOUT_SEGUNDOS` (30 por
  defecto), `LATIDO_REVISION_SEGUNDOS` (5), `LATIDO_REFRESCO_SEGUNDOS` (60) y
  `LATIDO_ESTABILIDAD_SEGUNDOS` (60, tiempo conectado sin cortes para resolver
  la alerta de desconexión). Los casos de la sección 9 suponen los valores por
  defecto.
- Terminal 1, Servicio de Integración: `npm start`. Esperado en el log:
  `[iot-integration-service] Conectado a <host>:<puerto>` y la suscripción a
  los tópicos de mediciones, estado de ventiladores y latidos.
- Terminal 2, simulador, con los ids reales del punto 0.3 (PowerShell):

  ```powershell
  $env:SIMULADOR_INCUBADORA_ID = "<id de la incubadora>"
  $env:SIMULADOR_SENSOR_ID = "<id del dispositivo sensor>"
  $env:SIMULADOR_VENTILADOR_ID = "<id del dispositivo ventilador>"
  npm run simulator
  ```

  (En bash: `SIMULADOR_INCUBADORA_ID=... SIMULADOR_SENSOR_ID=... SIMULADOR_VENTILADOR_ID=... npm run simulator`.)
  Esperado: `[simulador] Conectado a <host>:<puerto>`.

Comportamiento del simulador a tener presente: publica cada 8 segundos una
medición con `temperatura` y `humedad` (caminata aleatoria que arranca en
37,5 °C y 55 %, acotada a 35–40 °C y 40–70 %) y un latido del sensor y del
ventilador. No hay una opción para forzar un valor puntual: para provocar
mediciones dentro o fuera de rango **se mueven los límites configurados**
(sección 8), no el simulador.

### 0.5 Frontend

En `frontend/` crear `.env` con las variables `VITE_FIREBASE_API_KEY`,
`VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
`VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID` y
`VITE_FIREBASE_APP_ID`, y levantar la aplicación con `npm run dev`.

> **Navegación:** el menú lateral (`Sidebar`) todavía no está montado en el
> layout, así que no hay enlaces de menú a "Alertas" ni a "Límites". Se entra
> escribiendo la URL (`/alertas`, `/alertas/<id>`, `/configuracion/limites`)
> o, para una alerta puntual, desde el enlace "Ver alerta" del banner.

### 0.6 Cómo forzar cada tipo de alerta

El simulador arranca en 37,5 °C y 55 %. Se configuran los límites en
`/configuracion/limites` (sección 8) de modo que el valor actual quede fuera:

| Tipo esperado (`ALERT_TYPES`) | Límites a guardar | Por qué dispara |
| ----------------------------- | ----------------- | ---------------- |
| *(ninguna, dentro de rango)* | Temperatura 34–41 °C y humedad 35–75 % | El simulador nunca sale de 35–40 °C ni de 40–70 %. |
| `temperatura_alta` | Temperatura mínimo 30, máximo 36 | 37,5 > 36. `limite` de la alerta = 36. |
| `temperatura_baja` | Temperatura mínimo 39, máximo 41 | 37,5 < 39. `limite` de la alerta = 39. |
| `humedad_alta` | Humedad mínimo 10, máximo 50 | 55 > 50. `limite` = 50. |
| `humedad_baja` | Humedad mínimo 60, máximo 90 | 55 < 60. `limite` = 60. |

La alerta se genera con la **siguiente** medición que llega después de guardar
los límites (hasta unos 8 segundos). Cuando se prueba un tipo, conviene dejar
los otros límites en el rango amplio de la primera fila para no mezclar
alertas.

### 0.7 Cómo forzar la resolución automática

`evaluarUmbrales` revisa, con cada medición, las alertas abiertas (`activa` o
`reconocida`) de esa incubadora y variable. Para evitar que un valor que
oscila sobre el límite abra y cierre alertas (y envíe un correo) en cada
medición, usa una banda de histéresis: el valor debe volver al interior del
rango por un margen.

- `margen = (maximo − minimo) × 0,05` (5 % del rango).
- Una alerta `*_alta` se resuelve cuando `valor ≤ maximo − margen`.
- Una alerta `*_baja` se resuelve cuando `valor ≥ minimo + margen`.
- Entre el límite y el límite menos (o más) el margen, la alerta sigue abierta
  y no se crea ninguna nueva.
- Guardar nuevos límites **no** modifica las alertas existentes: la
  resolución (o no) ocurre al procesar la **siguiente** medición.

| Objetivo | Límites a guardar con la alerta abierta | Por qué |
| -------- | ---------------------------------------- | ------- |
| Resolver una alerta de temperatura (alta o baja) | Temperatura 34–41 °C (primera fila de 0.6) | Margen 0,35: una `alta` se resuelve con `valor ≤ 40,65` y una `baja` con `valor ≥ 34,35`; el simulador se mantiene entre 35 y 40 °C. |
| Resolver una alerta de humedad (alta o baja) | Humedad 35–75 % (primera fila de 0.6) | Margen 2: una `alta` se resuelve con `valor ≤ 73` y una `baja` con `valor ≥ 37`; el simulador se mantiene entre 40 y 70 %. |
| Dejar el valor dentro de la banda de una alerta `alta` (no se resuelve) | Tomar el último `valor` V de `mediciones` y guardar `minimo` ≈ V − 25 y `maximo` ≈ V + 0,3 (ejemplo: V = 37,4 → temperatura 12–37,7) | Con el ejemplo (12–37,7): rango 25,7 y margen ≈ 1,3. La banda sin resolver es `(maximo − margen, maximo]`, es decir (36,4; 37,7], que contiene a V = 37,4. |
| Dejar el valor dentro de la banda de una alerta `baja` (no se resuelve) | Con una alerta `temperatura_baja` abierta (límites 39–41), tomar el último `valor` V y guardar `minimo` ≈ V − 0,3 y `maximo` ≈ V + 25 (ejemplo: V = 37,4 → temperatura 37,1–62) | Con el ejemplo (37,1–62): rango 24,9 y margen ≈ 1,2. La alerta `baja` se resuelve solo con `valor ≥ minimo + margen` (≈ 38,3), y V = 37,4 queda en la banda sin resolver [37,1; 38,3), por lo que no se resuelve. Como V está por encima de `minimo`, tampoco se crea una alerta nueva. |

El simulador no permite fijar un valor puntual (la temperatura varía hasta
±0,15 °C y la humedad hasta ±1,5 % por medición). En los casos de banda (11.4
y 11.5), comprobar en el documento de `mediciones` evaluado que su `valor`
realmente quedó dentro de la banda; si no, repetir el caso con el último
valor.

## 1. Medición dentro del rango

Antes de las secciones 1 a 8, comprobar que no quedan alertas de desconexión
abiertas de pruebas anteriores (sección 9): cuentan como alertas abiertas en
"Estado general" y en los contadores del listado. Se resuelven solas cuando el
dispositivo lleva 60 segundos conectado (caso 9.14).

| Caso | Pasos | Resultado esperado |
| ---- | ----- | -------------------- |
| 1.1 | Con límites amplios (primera fila de 0.6), abrir `/dashboard` como `administrador`, seleccionar la incubadora de prueba y dejar el simulador corriendo 30 segundos. | En el log del Servicio de Integración aparece, por cada variable de cada medición, `Medición enviada a procesarMedicion: <incubadoraId>/<dispositivoId> (temperatura)` y `(humedad)`. No se registra ningún error. |
| 1.2 | En Firestore, revisar la colección `mediciones`. | Por cada mensaje del simulador hay dos documentos nuevos (uno por variable) con `incubadoraId`, `dispositivoId`, `variable` (`temperatura` o `humedad`), `valor` numérico, `unidad` (`°C` o `%`), `medidoEn` y `creadoEn` (timestamps). |
| 1.3 | En Firestore, revisar `dispositivos/<id del sensor>`. | `estadoConexion` es `"conectado"` y `ultimaComunicacionEn` se actualiza (la Cloud Function lo escribe con cada medición). |
| 1.4 | Observar el panel general sin recargar la página. | Las tarjetas "Temperatura" y "Humedad" muestran el último valor y "Última lectura: HH:MM", y cambian en tiempo real con cada medición. No aparece el texto "Temperatura fuera del umbral" ni "Humedad fuera del umbral", y las tarjetas no se resaltan en rojo. |
| 1.5 | En Firestore, revisar la colección `alertas`. | No se creó ninguna alerta nueva. |
| 1.6 | Observar "Estado general" y el resumen en el panel. | "Estado general" muestra "Normal"; el resumen cuenta la incubadora como "Normal". |

## 2. Medición fuera de rango (alta y baja) y creación de la alerta

Para cada fila, antes de empezar dejar la colección `alertas` sin alertas
`activa` ni `reconocida` del mismo tipo para esa incubadora (si quedó alguna de
una prueba anterior, ver el caso 3.3).

| Caso | Pasos | Resultado esperado |
| ---- | ----- | -------------------- |
| 2.1 | Guardar los límites de `temperatura_alta` (0.6) y esperar la siguiente medición. | Se crea un documento en `alertas` con `incubadoraId`, `dispositivoId` (el del sensor), `variable: "temperatura"`, `valor` (≈ 37,5), `limite: 36`, `tipo: "temperatura_alta"`, `estado: "activa"`, `titulo` ("Temperatura fuera de rango"), `mensaje` (texto en español con el valor y el límite), `medidoEn` y `creadaEn`. |
| 2.2 | Ídem con los límites de `temperatura_baja`. | Alerta con `tipo: "temperatura_baja"`, `limite: 39` y `estado: "activa"`. |
| 2.3 | Ídem con los límites de `humedad_alta`. | Alerta con `variable: "humedad"`, `tipo: "humedad_alta"`, `limite: 50`, `titulo` "Humedad fuera de rango". |
| 2.4 | Ídem con los límites de `humedad_baja`. | Alerta con `tipo: "humedad_baja"` y `limite: 60`. |
| 2.5 | Con la alerta de 2.1 creada, mirar la tarjeta "Temperatura" del panel. | La tarjeta se resalta (borde y fondo rojos) y muestra "Temperatura fuera del umbral". La tarjeta "Humedad" sigue normal si sus límites son amplios. Con la de 2.3, la tarjeta "Humedad" muestra "Humedad fuera del umbral". |
| 2.6 | Mirar "Estado general" y el resumen del panel. | "Estado general" pasa a "Advertencia" (hay una alerta abierta y ningún dispositivo desconectado) y el resumen cuenta la incubadora como "Advertencia". |
| 2.7 | Volver a guardar límites amplios (0.6, primera fila) con la alerta aún `activa`. | Las tarjetas dejan de resaltarse en cuanto se guardan los límites (el resaltado depende de los límites, no del estado de la alerta). La alerta sigue `activa` hasta que llega la siguiente medición; entonces `evaluarUmbrales` la resuelve (sección 11) y "Estado general" vuelve a "Normal". |

## 3. Sin alertas duplicadas

| Caso | Pasos | Resultado esperado |
| ---- | ----- | -------------------- |
| 3.1 | Con los límites de `temperatura_alta` guardados y una alerta `activa` ya creada, dejar el simulador publicando durante al menos 5 mediciones más. | La colección `alertas` no recibe otra alerta de `temperatura_alta` para la misma incubadora: sigue habiendo una sola. |
| 3.2 | Marcar esa alerta como `reconocida` (sección 7) y esperar más mediciones fuera de rango. | Tampoco se crea una alerta nueva: una alerta `reconocida` cuenta como abierta. |
| 3.3 | Guardar límites amplios (0.6, primera fila) y esperar una medición: la alerta pasa a `resuelta` automáticamente (sección 11). Volver a guardar los límites de `temperatura_alta` y esperar la siguiente medición. | Se crea una alerta nueva `activa` del mismo tipo, con otro id; la anterior queda `resuelta` (una alerta `resuelta` ya no cuenta como abierta). |
| 3.4 | Con una alerta `temperatura_alta` abierta, provocar una de `humedad_alta`. | Se crea la alerta de humedad: la deduplicación es por incubadora + variable + tipo, no global. |

## 4. Correo por la extensión Trigger Email

| Caso | Pasos | Resultado esperado |
| ---- | ----- | -------------------- |
| 4.1 | Provocar una alerta nueva (casos 2.x). En Firestore, revisar la colección `mail`. | Aparece un documento por cada `administrador` activo con `correo` válido: `to` con su correo, `message.subject` igual al `titulo` de la alerta, `message.text` igual al `mensaje` y `message.html` con ambos escapados. En el log de la función `notificarAlerta` figura `Correo preparado para N administrador(es).`. |
| 4.2 | Esperar unos segundos y revisar de nuevo el documento de `mail`. | La extensión agrega el campo `delivery` con su estado de envío; el estado final esperado es `SUCCESS`. |
| 4.3 | Revisar la bandeja del administrador. | Llega el correo con el asunto y el texto de la alerta. |
| 4.4 | Revisar las bandejas del `operador` y del usuario de `consulta`. | No reciben correo: solo se notifica a los administradores activos. |
| 4.5 | Dejar al único administrador con `activo: false` (o sin `correo`) y provocar una alerta. | La alerta se crea igual y se ve en la aplicación; no se crea ningún documento en `mail` (en el log: "No existen administradores activos para notificar." / "Los administradores activos no tienen correos válidos."). |

## 5. Banner en la aplicación y enlace "Ver alerta"

| Caso | Pasos | Resultado esperado |
| ---- | ----- | -------------------- |
| 5.1 | Con la aplicación abierta en cualquier página autenticada (por ejemplo `/dashboard`), provocar una alerta nueva. | Sin recargar, aparece el banner con el `titulo` y el `mensaje` de la alerta activa más reciente. |
| 5.2 | Pulsar "Ver alerta" en el banner. | Navega a `/alertas/<id de la alerta>` y se abre el detalle de esa alerta. |
| 5.3 | Volver, y pulsar la "×" del banner ("Descartar notificación"). | El banner desaparece para esa alerta. Una alerta posterior vuelve a mostrar el banner. |
| 5.4 | Repetir 5.1 con un usuario `operador` y con uno de `consulta`. | El banner y el enlace "Ver alerta" funcionan igual para los tres roles. |
| 5.5 | Marcar la alerta como `reconocida` (sección 7) con el banner visible. | El banner desaparece (solo muestra alertas `activa`). |

## 6. Listado de alertas con filtro por estado

| Caso | Pasos | Resultado esperado |
| ---- | ----- | -------------------- |
| 6.1 | Con alertas en los tres estados (usar 2.x, la sección 7 y, para `resuelta`, la resolución automática de 3.3 o de la sección 11), abrir `/alertas`. | Se muestran las alertas de **todas** las incubadoras, de la más reciente a la más antigua, con ícono por tipo, título, mensaje, estado y fecha. Los botones de filtro muestran contadores: "Todas (n)", "Activas (n)", "Reconocidas (n)" y "Resueltas (n)". |
| 6.2 | Pulsar cada filtro: "Activas", "Reconocidas", "Resueltas" y "Todas". | La lista muestra solo las alertas de ese estado; el filtro seleccionado queda resaltado. |
| 6.3 | Elegir un filtro sin alertas. | Aparece "No hay alertas" con el texto "No hay alertas activas." (o reconocidas / resueltas, según el filtro). |
| 6.4 | Con `/alertas` abierto, provocar una alerta nueva. | La alerta aparece en la lista sin recargar y los contadores se actualizan. |
| 6.5 | Cambiar el estado de una alerta desde otra pestaña (sección 7). | La lista y los contadores de esta pestaña se actualizan solos. |
| 6.6 | Pulsar una alerta de la lista. | Navega a `/alertas/<id>`. |
| 6.7 | Abrir `/alertas` con `operador` y con `consulta`. | Ambos roles ven el listado completo (la ruta es accesible para cualquier rol válido). |

## 7. Detalle de alerta y "Marcar como reconocida"

| Caso | Pasos | Resultado esperado |
| ---- | ----- | -------------------- |
| 7.1 | Como `administrador`, abrir el detalle de una alerta `activa`. | Se muestran: título, mensaje, estado, y las filas "Incubadora" (el nombre; el id si no se puede leer), "Variable", "Valor registrado" (con °C o %), "Límite excedido" (con °C o %), "Tipo" (por ejemplo "Temperatura alta"), "Estado" y "Generada el" (fecha y hora). Hay un enlace "← Volver al listado" hacia `/alertas`. |
| 7.2 | Pulsar "Marcar como reconocida". | El botón se deshabilita mientras guarda. El campo `estado` del documento pasa a `reconocida` y la pantalla lo refleja en tiempo real (el botón desaparece y el estado muestra "Reconocida"). No cambia ningún otro campo del documento. |
| 7.3 | Repetir 7.1 y 7.2 como `operador`. | El botón "Marcar como reconocida" es visible y funciona igual que para el administrador. |
| 7.4 | Abrir el detalle de una alerta `activa` como usuario de `consulta`. | Se ve toda la información, pero **no** aparece el botón "Marcar como reconocida". |
| 7.5 | Abrir el detalle de una alerta `reconocida` o `resuelta` como `administrador`. | No aparece el botón (solo se ofrece para alertas `activa`). |
| 7.6 | Intentar escribir `estado: "reconocida"` en `alertas/<id>` como usuario de `consulta` (por ejemplo con el simulador de reglas de la consola de Firebase, autenticado con `role: "consulta"`, o con el emulador de Firestore). | Firestore rechaza la escritura (`permission-denied`): las reglas solo permiten actualizar a administrador u operador. |
| 7.7 | Con el simulador de reglas / emulador, como `operador` o `administrador`: (a) actualizar `estado` a `"activa"`; (b) actualizar `estado` a `"reconocida"` junto con otro campo (por ejemplo `valor`); (c) actualizar solo `estado` a `"resuelta"`. | (a) y (b) se rechazan; (c) se permite. Las reglas solo admiten cambiar el campo `estado`, y solo hacia `reconocida` o `resuelta`. |
| 7.8 | Intentar crear o borrar un documento de `alertas` desde el cliente (cualquier rol). | Rechazado: `allow create: if false;` y `allow delete: if false;`. |
| 7.9 | Abrir `/alertas/id-inexistente`. | Aparece "Alerta no encontrada" con el enlace "← Volver al listado". |

## 8. Configuración de límites (umbrales)

Ruta: `/configuracion/limites` (título "Límites de monitoreo"). La página muestra
un selector "Incubadora" y dos secciones, "Temperatura (°C)" y "Humedad (%)",
cada una con "Mínimo" y "Máximo" y su propio botón ("Guardar temperatura" /
"Guardar humedad").

| Caso | Pasos | Resultado esperado |
| ---- | ----- | -------------------- |
| 8.1 | Como `administrador`, abrir `/configuracion/limites`. | Carga la página y lista las incubadoras no inactivas. Si ya hay límites guardados para la incubadora elegida, los campos aparecen precargados; si no, vacíos. Cada sección indica su rango de referencia ("Referencia: 37.2 a 37.8 °C" y "Referencia: 45 a 65 %"). |
| 8.2 | Elegir la incubadora de prueba, ingresar temperatura mínimo 30 y máximo 36, y pulsar "Guardar temperatura". | Mensaje "Los límites de temperatura se guardaron correctamente." En Firestore existe `umbrales/<incubadoraId>_temperatura` con `incubadoraId`, `variable: "temperatura"`, `minimo: 30` y `maximo: 36` (numéricos) y `actualizadoEn`. |
| 8.3 | Ídem para humedad (mínimo 10, máximo 50) con "Guardar humedad". | Mensaje de éxito y documento `umbrales/<incubadoraId>_humedad` con los mismos campos. La sección de temperatura no se ve afectada. |
| 8.4 | Recargar la página y volver a elegir la incubadora. | Los campos aparecen precargados con los valores guardados. |
| 8.5 | Guardar mínimo **igual** al máximo (por ejemplo 36 y 36). | Mensaje "El mínimo debe ser menor que el máximo." No se escribe en Firestore. |
| 8.6 | Guardar mínimo **mayor** que el máximo (por ejemplo 40 y 35). | Mismo mensaje "El mínimo debe ser menor que el máximo." No se escribe en Firestore. |
| 8.7 | Dejar un campo vacío o escribir un valor no numérico y guardar. | Mensajes "Ingrese un mínimo numérico." / "Ingrese un máximo numérico." junto al campo; no se escribe en Firestore. |
| 8.8 | En humedad, guardar un mínimo menor que 0 o un máximo mayor que 100 (por ejemplo 20 y 120). | Mensaje "La humedad debe estar entre 0 y 100 %." No se escribe en Firestore. |
| 8.9 | Mientras guarda, observar los controles. | Los campos, el selector y los botones quedan deshabilitados y el botón muestra "Guardando...". |
| 8.10 | Cambiar los límites con el panel general abierto en otra pestaña. | Las tarjetas "Temperatura" y "Humedad" recalculan el resaltado "fuera del umbral" sin recargar. |
| 8.11 | Con límites que dejen el valor actual fuera de rango (0.6), esperar la siguiente medición. | Se genera la alerta correspondiente (casos 2.x): los límites guardados desde la pantalla son los que lee la Cloud Function (`umbrales/{incubadoraId}_{variable}`, campos `minimo` y `maximo`). |
| 8.12 | Iniciar sesión como `operador` y abrir `/configuracion/limites` escribiendo la URL. | Se redirige a `/sin-autorizacion` ("Acceso no autorizado" y "No tienes permisos para acceder a esta sección."). No se muestra el formulario. |
| 8.13 | Ídem como usuario de `consulta`. | Mismo resultado que 8.12. |
| 8.14 | Sin sesión iniciada, abrir `/configuracion/limites`. | Redirige a `/login`. |
| 8.15 | Con el simulador de reglas / emulador, intentar escribir en `umbrales/<id>` como `operador` y como `consulta`. | Rechazado (`allow create, update, delete: if isAdmin();`). La lectura de `umbrales` sí está permitida a cualquier usuario autenticado. |

## 9. Desconexión de dispositivo

Requiere el Servicio de Integración con la detección de desconexión y con la
alerta de desconexión (ver 0.1). Cubre RF-016 (informar cuando un sensor deja
de comunicarse): además de marcar el dispositivo `desconectado`, el servicio
crea una alerta `dispositivo_desconectado` (sin duplicados mientras haya una
abierta) que sigue el mismo camino que las de umbral (correo, banner, listado y
detalle) y la resuelve cuando el dispositivo lleva 60 segundos conectado sin
cortes (`LATIDO_ESTABILIDAD_SEGUNDOS`), no en cuanto vuelve a dar señales.

Tanto los latidos como las mediciones válidas cuentan como señal de vida, por
lo que para provocar la desconexión hay que **detener el simulador completo**
(Ctrl+C): detener solo los latidos no alcanza mientras sigan llegando
mediciones. El Servicio de Integración tiene que seguir corriendo. El simulador
publica latidos del sensor y del ventilador, así que **cada dispositivo genera
su propia alerta**: al detener el simulador completo se crean dos alertas (y
dos correos por administrador).

| Caso | Pasos | Resultado esperado |
| ---- | ----- | -------------------- |
| 9.1 | Con el simulador y el Servicio de Integración corriendo, abrir el panel general. | Los dispositivos de la incubadora están `conectado` en Firestore. Si el dispositivo estaba `desconocido` o `desconectado`, el log del servicio registra `Dispositivo "<id>" conectado (...)` al recibir su primera señal. La tarjeta "Estado de conexión" muestra "Conectado" con "Última comunicación: hace unos segundos". |
| 9.2 | Detener el simulador (Ctrl+C) y anotar la hora. Esperar más de 30 segundos (la revisión corre cada 5 s por defecto, así que puede tardar hasta unos 35–40 s). | En el log del Servicio de Integración aparece `Dispositivo "<id>" desconectado (sin señales hace más de 30 s).` para el sensor y para el ventilador simulados. |
| 9.3 | En Firestore, revisar `dispositivos/<id>` de ambos. | `estadoConexion` pasó a `"desconectado"`. |
| 9.4 | Mirar el panel general sin recargar. | La tarjeta "Estado de conexión" pasa a "Desconectado" (con la hora relativa de la última comunicación); la tarjeta "Ventiladores" indica "1 sin conexión."; "Estado general" pasa a "Crítico"; el resumen cuenta la incubadora como "Crítico". |
| 9.5 | Con la incubadora desconectada **y** una alerta abierta (`activa` o `reconocida`) a la vez. | "Estado general" sigue en "Crítico": un dispositivo desconectado tiene prioridad sobre la alerta abierta (sea `activa` o `reconocida`). |
| 9.6 | Con dos incubadoras (0.3, punto 4), cada una con su propio simulador (ids propios en las variables `SIMULADOR_*`), detener solo el simulador de una de ellas. | El resumen cuenta una incubadora en "Crítico" y la otra en "Normal" (o "Advertencia" si tiene una alerta abierta); el total de incubadoras no cambia. |
| 9.7 | Volver a iniciar el simulador. | En el siguiente latido o medición el servicio marca el dispositivo de nuevo como `conectado` (log `Dispositivo "<id>" conectado (...)`). La tarjeta "Estado de conexión" vuelve a "Conectado" sin recargar. Como las alertas de desconexión siguen abiertas hasta cumplirse la ventana de 60 s (caso 9.14), "Estado general" pasa a "Advertencia" y no a "Normal"; vuelve a "Normal" (o sigue en "Advertencia" si hay otra alerta abierta) cuando se resuelven. |
| 9.8 | Reiniciar el Servicio de Integración con el simulador detenido, partiendo de un dispositivo que había quedado `conectado` en Firestore. | El servicio lo recupera al arrancar y le da un margen de 30 segundos desde el arranque; si no recibe señales en ese lapso lo marca `desconectado` y crea la alerta de desconexión (si ya había una abierta del dispositivo, no crea otra). La incubadora de la alerta sale de `dispositivos/<id>.incubadoraId` y su `ultimaSenalEn` es el momento del arranque del servicio, no la última señal real. |
| 9.9 | Con el Servicio de Integración detenido y el simulador apagado, esperar más de 30 segundos. | Nadie marca los dispositivos como desconectados ni se crea ninguna alerta: los dispositivos siguen `conectado` en Firestore. Es una limitación conocida (la detección corre dentro del servicio). |
| 9.10 | Después de 9.2, revisar la colección `alertas` (sin alertas de desconexión abiertas antes de empezar). | Hay **una** alerta nueva por cada dispositivo desconectado (el sensor y el ventilador simulados) con exactamente: `incubadoraId`, `dispositivoId`, `tipo: "dispositivo_desconectado"`, `estado: "activa"`, `titulo: "Dispositivo desconectado"`, `mensaje` ("El dispositivo <id> dejó de enviar señales hace más de 30 segundos."), `ultimaSenalEn` (timestamp cercano al último latido) y `creadaEn`. **No** tienen `variable`, `valor`, `limite` ni `medidoEn`. En el log del servicio: `Alerta de desconexión creada para "<id>".`. |
| 9.11 | Con las alertas de 9.10 abiertas, dejar los dispositivos desconectados varios minutos (varios ciclos de revisión de 5 s). Después marcar una de las alertas como `reconocida` (sección 7) y esperar otros minutos. | No se crea ninguna alerta nueva: sigue habiendo una por dispositivo. Una alerta `reconocida` también cuenta como abierta. |
| 9.12 | Después de 9.10, revisar la colección `mail`. | Por cada alerta de desconexión y por cada `administrador` activo con `correo` válido hay un documento con `message.subject` "Dispositivo desconectado" y `message.text` igual al `mensaje` de la alerta (sin textos "undefined" ni "NaN"). Con el simulador completo detenido cada administrador recibe dos correos, uno por dispositivo. El `operador` y el usuario de `consulta` no reciben ninguno (4.4). |
| 9.13 | Con la aplicación abierta en `/dashboard` (sin recargar) cuando se crea la alerta, y luego en `/alertas`. | Aparece el banner con el `titulo` y el `mensaje` de la alerta; "Ver alerta" abre `/alertas/<id>`. En el listado la tarjeta muestra el ícono 📡 con borde de advertencia, el título, el mensaje, el estado "Activa" y la fecha de creación, sin textos "undefined" ni "NaN" ni filas vacías; los contadores del filtro "Activas" la incluyen. Como `administrador` u `operador`, el detalle muestra "Incubadora", "Dispositivo" (el `dispositivoId`), "Sin señales desde" (fecha y hora de `ultimaSenalEn`), "Tipo" ("Dispositivo desconectado"), "Estado" y "Generada el"; **no** muestra "Variable", "Valor registrado" ni "Límite excedido". Al pulsar "Marcar como reconocida" pasa a "Reconocida" y el banner desaparece (7.2 y 5.5); con `consulta` el botón no aparece (7.4). |
| 9.14 | Con una alerta de 9.10 `activa`, volver a iniciar el simulador y anotar la hora T de la primera señal. Revisar `dispositivos/<id>` y `alertas` a T + 30 s, a T + 50 s y a partir de T + 75 s (la estabilidad se mide con las señales recibidas, así que la alerta se resuelve con la primera señal que cumple los 60 s y la comprobación corre en la revisión de 5 s). | El dispositivo vuelve a `conectado` de inmediato, pero antes de T + 60 s la alerta sigue `activa` (sin `resueltaEn`). Con los latidos del simulador cada 8 s se resuelve alrededor de T + 64 a T + 70 s (hasta un período de latido más que los 60 s configurados): pasa a `estado: "resuelta"` con `resueltaEn` (timestamp) y `resueltaPor: "sistema"`; no se agrega `valorResolucion` ni cambia ningún otro campo. En el log: `Alerta de desconexión de "<id>" resuelta (el dispositivo volvió a comunicarse).`. No se crea alerta nueva ni documento en `mail`. |
| 9.15 | Repetir 9.14 pero con la alerta marcada `reconocida` antes de reconectar el simulador. | También pasa a `resuelta` con `resueltaEn` y `resueltaPor: "sistema"`, pasados unos 60 s de conexión estable (alrededor de T + 64 a T + 70 s con el simulador). |
| 9.16 | Abrir `/alertas/<id>` de una alerta resuelta por 9.14, y luego `/alertas`. | El estado muestra "Resuelta" y debajo de la lista aparece el bloque con "Resuelta automáticamente", la fecha y hora de `resueltaEn` y la línea "El dispositivo volvió a comunicarse" (**no** "La medición volvió a ..."). Se sigue sin mostrar "Variable", "Valor registrado" ni "Límite excedido", y no aparece el botón "Marcar como reconocida". La alerta aparece bajo el filtro "Resueltas" y deja de contar en "Activas" y "Reconocidas". |
| 9.17 | Dispositivo intermitente: con una alerta abierta, iniciar el simulador, dejarlo corriendo menos de 60 s (por ejemplo 15 s, 40 s y 55 s en tres ciclos distintos) y detenerlo; esperar a que el servicio vuelva a marcar `desconectado` (más de 30 s sin señales) antes de cada ciclo siguiente. | Los dispositivos pasan varias veces a `conectado` y `desconectado`, pero sigue habiendo una sola alerta abierta por dispositivo (la misma, sin pasar a `resuelta`), no se crea ninguna alerta nueva y la colección `mail` no recibe documentos nuevos: un solo correo por dispositivo. Tras estabilizarse (simulador corriendo más de 60 s) la alerta se resuelve (9.14). |
| 9.18 | Reinicio con una alerta abierta: partiendo de 9.10 (alertas `activa`), detener el Servicio de Integración, iniciar el simulador y volver a iniciar el servicio. Anotar la hora de arranque. | Pasados unos 60 s del arranque con el dispositivo enviando señales, las alertas que quedaron abiertas pasan a `resuelta` (`resueltaPor: "sistema"`), aunque el servicio se haya reiniciado entre medio. Lo mismo ocurre con un dispositivo que ya figuraba `conectado` en Firestore al reiniciar. No se crean alertas nuevas ni correos. |

## 10. Resumen por incubadora (estado general)

| Caso | Pasos | Resultado esperado |
| ---- | ----- | -------------------- |
| 10.1 | Con dos incubadoras activas, abrir el panel general. | El resumen muestra el total de incubadoras, cuántas están en "Normal", "Advertencia" y "Crítico", y una fila por incubadora con su nombre y su estado. |
| 10.2 | Provocar una alerta solo en la incubadora A. | Solo la fila de A pasa a "Advertencia"; la de B sigue "Normal". Los contadores se actualizan en tiempo real. |
| 10.3 | Desactivar una incubadora (estado "Inactiva"). | Deja de aparecer en el selector y en el resumen del panel. |
| 10.4 | Cambiar el selector "Incubadora" del panel. | Las tarjetas (mediciones, límites, conexión, ventiladores y "Estado general") corresponden a la incubadora elegida; el resumen sigue mostrando todas. |

## 11. Resolución automática de alertas

La resolución la hace `evaluarUmbrales` con cada medición, aplicando la banda
de histéresis de 5 % descrita en 0.7. Ninguna pantalla ofrece un botón para
resolver una alerta. En todos los casos, antes de empezar, dejar la colección
`alertas` sin alertas abiertas de esa incubadora y variable.

| Caso | Pasos | Resultado esperado |
| ---- | ----- | -------------------- |
| 11.1 | Provocar una alerta `temperatura_alta` (2.1) y dejarla `activa`. Guardar límites amplios (temperatura 34–41 °C, 0.7) y esperar la siguiente medición. | El documento de la alerta pasa a `estado: "resuelta"` y recibe `resueltaEn` (timestamp), `resueltaPor: "sistema"` y `valorResolucion` (el `valor` de esa medición, ≤ 40,65). Los demás campos no cambian. No se crea una alerta nueva ni un documento en `mail` (`notificarAlerta` solo actúa al crear alertas). |
| 11.2 | Ídem 11.1, pero marcando antes la alerta como `reconocida` (sección 7). | También pasa a `resuelta` con los mismos campos: una alerta `reconocida` se resuelve igual que una `activa`. |
| 11.3 | Provocar una alerta `temperatura_baja` (2.2). Guardar límites amplios (temperatura 34–41 °C) y esperar la siguiente medición. | La alerta `baja` pasa a `resuelta` (`valor ≥ 34,35`) con `resueltaEn`, `resueltaPor: "sistema"` y `valorResolucion`. |
| 11.4 | Provocar una alerta `temperatura_alta` y, con ella abierta, guardar los límites de la fila "banda de una alerta `alta`" de 0.7 (ejemplo: temperatura 12–37,7 para V = 37,4). Esperar la siguiente medición y comprobar que su `valor` quedó entre `maximo − margen` y `maximo`. | La alerta sigue abierta (`activa` o `reconocida`, según estuviera), sin `resueltaEn`, `resueltaPor` ni `valorResolucion`. No se escribe nada en `alertas` ni en `mail`. |
| 11.5 | Provocar una alerta `temperatura_baja` y, con ella abierta, guardar los límites de la fila "banda de una alerta `baja`" de 0.7 (ejemplo: temperatura 37,1–62 para V = 37,4). Esperar la siguiente medición y comprobar que su `valor` quedó entre `minimo` y `minimo + margen`. | La alerta `baja` sigue abierta, sin campos de resolución, y no se crea ninguna alerta nueva. |
| 11.6 | Después de 11.1 (alerta `resuelta`), volver a guardar los límites de `temperatura_alta` (0.6) y esperar la siguiente medición. | Se crea una alerta nueva `activa` con otro id; la anterior sigue `resuelta`. Se generan de nuevo los documentos en `mail` por administrador (4.1) y el banner vuelve a aparecer (5.1). |
| 11.7 | Con una alerta `temperatura_alta` abierta (límites 30–36), guardar los límites de `temperatura_baja` (39–41) y esperar la siguiente medición. | En esa misma medición la alerta `temperatura_alta` pasa a `resuelta` (el valor está por debajo de `maximo − margen`) y se crea una alerta `temperatura_baja` `activa`. |
| 11.8 | Con una alerta `temperatura_alta` y una `humedad_alta` abiertas a la vez (3.4), guardar solo los límites amplios de temperatura (0.7) y esperar la siguiente medición. | Solo la alerta de temperatura pasa a `resuelta`: la resolución es por incubadora y variable, y la de humedad sigue abierta. |
| 11.9 | Con el panel general abierto sin recargar: provocar una alerta `temperatura_alta`; luego reconocerla (sección 7); luego guardar límites amplios y esperar la siguiente medición. | Con la alerta `activa`, "Estado general" y el resumen muestran "Advertencia". Tras reconocerla, siguen en "Advertencia" (la alerta está abierta mientras el valor siga fuera de rango). Solo después de la resolución automática vuelven a "Normal". |
| 11.10 | Abrir `/alertas/<id>` de una alerta resuelta automáticamente (11.1). | El estado muestra "Resuelta" y debajo de la lista de datos aparece un bloque con el texto "Resuelta automáticamente", la fecha y hora de `resueltaEn` y la línea "La medición volvió a <valorResolucion> °C" (o "%" para humedad). No aparece el botón "Marcar como reconocida". |
| 11.11 | Abrir el detalle de una alerta `activa` y el de una `reconocida`. | No aparece el bloque de resolución. |
| 11.12 | En la consola de Firestore, cambiar a mano `estado` de una alerta a `resuelta` (sin `resueltaPor`, `resueltaEn` ni `valorResolucion`) y abrir su detalle. Repetir con una alerta de desconexión. | El bloque muestra solo "Resuelta" (sin "automáticamente"), la fecha como "-" y no muestra la línea "La medición volvió a ..." (ni "El dispositivo volvió a comunicarse" en la de desconexión). No hay errores en la consola del navegador. |
| 11.13 | Abrir `/alertas` después de 11.1 y 11.3. | Las alertas resueltas aparecen bajo el filtro "Resueltas" y ya no bajo "Activas" ni "Reconocidas"; los contadores se actualizan solos. |
| 11.14 | Con una alerta de desconexión abierta (volver a iniciar el simulador tras 9.10 y actuar dentro de los primeros 60 s de conexión), guardar los límites de `temperatura_alta` (0.6) y esperar la siguiente medición; luego guardar límites amplios (0.7) y esperar otra. | Se crea la alerta `temperatura_alta` y, después, `evaluarUmbrales` la resuelve con `valorResolucion` (11.1). La alerta de desconexión no se ve afectada por la resolución por umbrales: no recibe `valorResolucion` y sigue abierta hasta que se cumplen sus 60 s de conexión estable (9.14), momento en que la resuelve el Servicio de Integración. El tipo `dispositivo_desconectado` no tiene `variable`, así que ninguna medición la evalúa. |

## 12. Registro de resultados

Completar al ejecutar el plan. `Resultado`: Aprobado / Fallido / Bloqueado.
`Evidencia`: captura de pantalla, extracto de log o enlace al documento de
Firestore.

| Caso | Descripción | Resultado | Evidencia |
| ---- | ----------- | --------- | --------- |
| 1.1 | Mediciones enviadas a `procesarMedicion` (log) | | |
| 1.2 | Documentos en `mediciones` con los campos esperados | | |
| 1.3 | `dispositivos/<id>` queda `conectado` con `ultimaComunicacionEn` | | |
| 1.4 | Tarjetas se actualizan en tiempo real sin resaltado | | |
| 1.5 | No se crea alerta dentro del rango | | |
| 1.6 | "Estado general" en "Normal" | | |
| 2.1 | Alerta `temperatura_alta` | | |
| 2.2 | Alerta `temperatura_baja` | | |
| 2.3 | Alerta `humedad_alta` | | |
| 2.4 | Alerta `humedad_baja` | | |
| 2.5 | Tarjeta resaltada "fuera del umbral" | | |
| 2.6 | "Estado general" en "Advertencia" | | |
| 2.7 | El resaltado sigue los límites, no el estado de la alerta | | |
| 3.1 | Sin duplicado con alerta `activa` | | |
| 3.2 | Sin duplicado con alerta `reconocida` | | |
| 3.3 | Alerta nueva tras `resuelta` | | |
| 3.4 | Deduplicación por variable y tipo | | |
| 4.1 | Documentos en `mail` por administrador activo | | |
| 4.2 | Estado de envío de la extensión (`delivery`) | | |
| 4.3 | Correo recibido por el administrador | | |
| 4.4 | Operador y consulta no reciben correo | | |
| 4.5 | Sin administradores activos: alerta creada, sin correo | | |
| 5.1 | Banner aparece en tiempo real | | |
| 5.2 | "Ver alerta" abre el detalle | | |
| 5.3 | Descartar el banner | | |
| 5.4 | Banner para los tres roles | | |
| 5.5 | Banner desaparece al reconocer | | |
| 6.1 | Listado de alertas de todas las incubadoras | | |
| 6.2 | Filtro por estado | | |
| 6.3 | Estado vacío del filtro | | |
| 6.4 | Alerta nueva aparece sin recargar | | |
| 6.5 | Cambio de estado se refleja en el listado | | |
| 6.6 | Clic en una alerta abre el detalle | | |
| 6.7 | Listado accesible para operador y consulta | | |
| 7.1 | Contenido del detalle | | |
| 7.2 | "Marcar como reconocida" (administrador) | | |
| 7.3 | "Marcar como reconocida" (operador) | | |
| 7.4 | Botón oculto para consulta | | |
| 7.5 | Botón oculto si la alerta no está `activa` | | |
| 7.6 | Firestore rechaza escritura de consulta | | |
| 7.7 | Reglas: solo `estado`, solo `reconocida`/`resuelta` | | |
| 7.8 | Reglas: sin crear ni borrar alertas | | |
| 7.9 | Alerta inexistente | | |
| 8.1 | Página de límites (administrador) y precarga | | |
| 8.2 | Guardar límites de temperatura | | |
| 8.3 | Guardar límites de humedad | | |
| 8.4 | Valores precargados tras recargar | | |
| 8.5 | Rechazo de mínimo igual al máximo | | |
| 8.6 | Rechazo de mínimo mayor que el máximo | | |
| 8.7 | Rechazo de campos vacíos o no numéricos | | |
| 8.8 | Humedad fuera de 0–100 | | |
| 8.9 | Controles deshabilitados al guardar | | |
| 8.10 | Tarjetas recalculan el resaltado | | |
| 8.11 | Los límites guardados generan alertas | | |
| 8.12 | Operador redirigido a `/sin-autorizacion` | | |
| 8.13 | Consulta redirigido a `/sin-autorizacion` | | |
| 8.14 | Sin sesión redirige a `/login` | | |
| 8.15 | Reglas: solo administrador escribe `umbrales` | | |
| 9.1 | Dispositivos conectados con el simulador activo | | |
| 9.2 | Log de desconexión tras más de 30 s | | |
| 9.3 | `estadoConexion` pasa a `desconectado` | | |
| 9.4 | Panel: conexión, ventiladores, "Crítico" y resumen | | |
| 9.5 | Prioridad de "Crítico" sobre la alerta abierta | | |
| 9.6 | Resumen con una incubadora desconectada | | |
| 9.7 | Reconexión restaura el estado | | |
| 9.8 | Recuperación al reiniciar el servicio (y alerta si no hay señales) | | |
| 9.9 | Servicio detenido: nadie marca la desconexión ni crea alertas | | |
| 9.10 | La desconexión crea una alerta con los campos esperados (sin variable, valor, límite ni medidoEn) | | |
| 9.11 | Sin alertas duplicadas mientras haya una abierta (`activa` o `reconocida`) | | |
| 9.12 | Un correo por alerta de desconexión y administrador activo | | |
| 9.13 | Banner, listado y detalle de la alerta sin "undefined" ni "NaN" | | |
| 9.14 | Reconexión estable (60 s) resuelve la alerta `activa` sola | | |
| 9.15 | Reconexión estable resuelve la alerta `reconocida` | | |
| 9.16 | Detalle de la alerta resuelta: "El dispositivo volvió a comunicarse" | | |
| 9.17 | Dispositivo intermitente: una sola alerta y un solo correo | | |
| 9.18 | Reinicio del servicio con una alerta abierta | | |
| 10.1 | Resumen con dos incubadoras | | |
| 10.2 | Alerta en una sola incubadora | | |
| 10.3 | Incubadora inactiva fuera del resumen | | |
| 10.4 | Selector de incubadora del panel | | |
| 11.1 | Alerta `activa` se resuelve sola (campos de resolución, sin correo) | | |
| 11.2 | Alerta `reconocida` se resuelve sola | | |
| 11.3 | Alerta `baja` se resuelve sola | | |
| 11.4 | Banda de histéresis: la alerta `alta` no se resuelve | | |
| 11.5 | Banda de histéresis: la alerta `baja` no se resuelve | | |
| 11.6 | Tras resolverse, la condición crea una alerta nueva con correo y banner | | |
| 11.7 | Salto de extremo a extremo: se resuelve una y se crea la otra | | |
| 11.8 | La resolución es por variable | | |
| 11.9 | "Estado general" sigue en "Advertencia" tras reconocer y vuelve a "Normal" al resolverse | | |
| 11.10 | Detalle de una alerta resuelta automáticamente | | |
| 11.11 | Detalle sin bloque de resolución en alertas abiertas | | |
| 11.12 | Detalle de una alerta resuelta a mano (sin campos de resolución) | | |
| 11.13 | Listado: alertas resueltas bajo el filtro "Resueltas" | | |
| 11.14 | La resolución por umbrales no afecta a las alertas de desconexión | | |

## Notas

- **Plan documentado; ejecución pendiente (requiere Firebase y broker
  reales).** Ningún caso fue ejecutado al redactar este documento; no hay
  resultados ni evidencias que reportar todavía.
- Los casos 7.6, 7.7, 7.8 y 8.15 pueden ejecutarse con el simulador de reglas
  de la consola de Firebase o con el emulador de Firestore
  (`firebase emulators:start`); el resto requiere el proyecto real, el broker
  y el Servicio de Integración.
- `docs/contrato-mqtt.md` describe los tópicos con el prefijo `mtpa/`, pero el
  valor efectivo es el de `MQTT_TOPIC_PREFIX` (`mtpa-dev` por defecto), igual
  que en `docs/pruebas/plan-pruebas-simulador.md`.
- Las páginas de alertas y de límites traducen los errores de Firebase a
  mensajes en español (por ejemplo, `permission-denied` se muestra como "No
  tienes permisos para ..."); este plan no incluye un caso manual para
  provocarlos desde la interfaz porque, sin red, Firestore deja la escritura
  en cola en lugar de rechazarla.
- La aplicación no ofrece un botón para pasar una alerta a `resuelta`: la
  interfaz solo permite "Marcar como reconocida" y la resolución la hace
  automáticamente `evaluarUmbrales` con cada medición (sección 11). Las
  reglas de Firestore sí admiten que un administrador u operador escriba
  `estado: "resuelta"` desde un cliente (caso 7.7, inciso c); el cambio manual
  en la consola del caso 11.12 sirve solo para probar el detalle con una
  alerta sin campos de resolución.
- La resolución de alertas de umbral solo ocurre al procesar una medición nueva
  de esa incubadora y variable: si el dispositivo deja de enviar mediciones (por
  ejemplo, está desconectado), una alerta abierta no se resuelve aunque se
  amplíen los límites. Las alertas de desconexión no dependen de las
  mediciones: las resuelve el Servicio de Integración tras 60 s de conexión
  estable (sección 9).
- Alerta de desconexión: si falla la escritura de la alerta (error de
  Firestore) el servicio lo registra una sola vez en su log y reintenta crearla
  en cada ciclo mientras el dispositivo siga `desconectado`, sin crear
  duplicados. Si el dispositivo vuelve a comunicarse antes de que se cree, esa
  caída queda sin alerta y la próxima caída avisa con normalidad. Este fallo es
  difícil de provocar a mano (el Admin SDK ignora las reglas de Firestore), por
  lo que este plan no incluye un caso manual para él. Una alerta resuelta no
  vuelve a abrirse: una caída posterior crea una alerta nueva (y un correo
  nuevo).
- El resumen y el "Estado general" del panel consideran como máximo las 200
  alertas abiertas (`activa` o `reconocida`) más recientes: una alerta abierta
  más antigua que esas 200 no se cuenta. No afecta a las pruebas de este plan.
- Una vez ejecutado el plan, completar la sección 12 y, si algún caso falla,
  abrir una incidencia con el identificador del caso y la evidencia.
