# Plan de pruebas — Monitoreo, alertas y desconexión (CU-02)

Casos de prueba de extremo a extremo para el caso de uso **CU-02 (monitoreo
ambiental y alertas)** del Sprint 3, usando el simulador de dispositivo
(`iot-integration-service/simulator/simulador.js`) en lugar de hardware real.

El flujo cubierto es:

```
simulador MQTT -> Servicio de Integración IoT -> procesarMedicion (Cloud Function)
  -> mediciones/{id} + dispositivos/{id} (estadoConexion, ultimaComunicacionEn)
  -> evaluarUmbrales -> alertas/{id} (estado "activa")
       -> notificarAlerta -> colección "mail" -> extensión Trigger Email -> correo
       -> banner en la aplicación ("Ver alerta") -> listado /alertas -> detalle /alertas/:id
  -> panel general (/dashboard): tarjetas, estado general y resumen de incubadoras
Configuración de límites (umbrales): /configuracion/limites (solo administrador)
Desconexión: el Servicio de Integración marca el dispositivo "desconectado"
```

> **Estado de este plan: Plan documentado; ejecución pendiente (requiere
> Firebase y broker reales).**
>
> Ningún caso de este documento fue ejecutado. Todos requieren un proyecto de
> Firebase real (o su emulador), el broker MQTT (HiveMQ Cloud) y el Servicio
> de Integración en ejecución. Las columnas `Resultado` y `Evidencia` de la
> sección 11 están vacías a propósito: se completan al ejecutar las pruebas.

## 0. Prerrequisitos

### 0.1 Código bajo prueba

- El panel general, las páginas de alertas y la página de límites del Sprint 3
  (ramas `feat/sprint-3-umbrales`, `feat/sprint-3-alertas-paginas` y
  `feat/sprint-3-dashboard-acabado`, o `main` una vez integradas).
- Para la sección 9: el Servicio de Integración con detección de desconexión
  (`iot-integration-service/lib/estado-conexion.js`, rama
  `feat/sprint-3-deteccion-desconexion`; al redactar este plan todavía no
  estaba integrada en `main`). Sin ese cambio ningún proceso marca
  dispositivos como `desconectado`.

### 0.2 Firebase

| Elemento | Qué debe estar listo |
| -------- | -------------------- |
| Cloud Functions | Desplegadas `procesarMedicion` (HTTPS), `notificarAlerta` (trigger `onCreate` de `alertas/{alertaId}`), `gestionarUsuario`, `gestionarIncubadora` y `crearDispositivo`. |
| `INTEGRATION_SERVICE_TOKEN` | Configurado en las Cloud Functions; `procesarMedicion` responde `403` si el token no coincide. Debe ser el mismo valor que `PROCESAR_MEDICION_TOKEN` del Servicio de Integración. |
| Reglas | `firestore.rules` desplegadas: `umbrales` (lectura autenticada, escritura solo administrador) y `alertas` (actualización solo administrador u operador, únicamente el campo `estado`, únicamente hacia `reconocida` o `resuelta`). |
| Índices | `firestore.indexes.json` desplegado. Las consultas de monitoreo (`mediciones`, `alertas`, `umbrales`, `dispositivos`) no necesitan índices compuestos; el único índice declarado es el de `ordenes_ventilador`. |
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
  defecto), `LATIDO_REVISION_SEGUNDOS` (5) y `LATIDO_REFRESCO_SEGUNDOS` (60).
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

## 1. Medición dentro del rango

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
| 2.6 | Mirar "Estado general" y el resumen del panel. | "Estado general" pasa a "Advertencia" (hay una alerta activa y ningún dispositivo desconectado) y el resumen cuenta la incubadora como "Advertencia". |
| 2.7 | Volver a guardar límites amplios (0.6, primera fila) con la alerta aún `activa`. | Las tarjetas dejan de resaltarse en la siguiente medición (el resaltado depende de los límites, no del estado de la alerta). "Estado general" sigue en "Advertencia" mientras la alerta esté `activa`. |

## 3. Sin alertas duplicadas

| Caso | Pasos | Resultado esperado |
| ---- | ----- | -------------------- |
| 3.1 | Con los límites de `temperatura_alta` guardados y una alerta `activa` ya creada, dejar el simulador publicando durante al menos 5 mediciones más. | La colección `alertas` no recibe otra alerta de `temperatura_alta` para la misma incubadora: sigue habiendo una sola. |
| 3.2 | Marcar esa alerta como `reconocida` (sección 7) y esperar más mediciones fuera de rango. | Tampoco se crea una alerta nueva: una alerta `reconocida` cuenta como abierta. |
| 3.3 | En la consola de Firestore, cambiar manualmente `estado` de esa alerta a `resuelta` (la aplicación no ofrece ese botón) y esperar la siguiente medición fuera de rango. | Se crea una alerta nueva `activa` del mismo tipo (una alerta `resuelta` ya no cuenta como abierta). |
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
| 6.1 | Con alertas en los tres estados (usar 2.x, la sección 7 y, para `resuelta`, el cambio manual de 3.3), abrir `/alertas`. | Se muestran las alertas de **todas** las incubadoras, de la más reciente a la más antigua, con ícono por tipo, título, mensaje, estado y fecha. Los botones de filtro muestran contadores: "Todas (n)", "Activas (n)", "Reconocidas (n)" y "Resueltas (n)". |
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

Requiere el Servicio de Integración con la detección de desconexión (ver 0.1).
Tanto los latidos como las mediciones válidas cuentan como señal de vida, por
lo que para provocar la desconexión hay que **detener el simulador completo**
(Ctrl+C): detener solo los latidos no alcanza mientras sigan llegando
mediciones. El Servicio de Integración tiene que seguir corriendo.

| Caso | Pasos | Resultado esperado |
| ---- | ----- | -------------------- |
| 9.1 | Con el simulador y el Servicio de Integración corriendo, abrir el panel general. | Los dispositivos de la incubadora están `conectado` en Firestore. Si el dispositivo estaba `desconocido` o `desconectado`, el log del servicio registra `Dispositivo "<id>" conectado (...)` al recibir su primera señal. La tarjeta "Estado de conexión" muestra "Conectado" con "Última comunicación: hace unos segundos". |
| 9.2 | Detener el simulador (Ctrl+C) y anotar la hora. Esperar más de 30 segundos (la revisión corre cada 5 s por defecto, así que puede tardar hasta unos 35–40 s). | En el log del Servicio de Integración aparece `Dispositivo "<id>" desconectado (sin señales hace más de 30 s).` para el sensor y para el ventilador simulados. |
| 9.3 | En Firestore, revisar `dispositivos/<id>` de ambos. | `estadoConexion` pasó a `"desconectado"`. |
| 9.4 | Mirar el panel general sin recargar. | La tarjeta "Estado de conexión" pasa a "Desconectado" (con la hora relativa de la última comunicación); la tarjeta "Ventiladores" indica "1 sin conexión."; "Estado general" pasa a "Crítico"; el resumen cuenta la incubadora como "Crítico". |
| 9.5 | Con la incubadora desconectada **y** una alerta activa a la vez. | "Estado general" sigue en "Crítico": un dispositivo desconectado tiene prioridad sobre la alerta activa. |
| 9.6 | Con dos incubadoras (0.3, punto 4), cada una con su propio simulador (ids propios en las variables `SIMULADOR_*`), detener solo el simulador de una de ellas. | El resumen cuenta una incubadora en "Crítico" y la otra en "Normal" (o "Advertencia" si tiene una alerta activa); el total de incubadoras no cambia. |
| 9.7 | Volver a iniciar el simulador. | En el siguiente latido o medición el servicio marca el dispositivo de nuevo como `conectado` (log `Dispositivo "<id>" conectado (...)`). El panel vuelve a "Conectado" y "Estado general" a "Normal" (o "Advertencia" si hay una alerta activa), sin recargar. |
| 9.8 | Reiniciar el Servicio de Integración con el simulador detenido, partiendo de un dispositivo que había quedado `conectado` en Firestore. | El servicio lo recupera al arrancar y le da un margen de 30 segundos desde el arranque; si no recibe señales en ese lapso lo marca `desconectado`. |
| 9.9 | Con el Servicio de Integración detenido y el simulador apagado, esperar más de 30 segundos. | Nadie marca los dispositivos como desconectados: siguen `conectado` en Firestore. Es una limitación conocida (la detección corre dentro del servicio). |
| 9.10 | Revisar la colección `alertas` después de 9.2. | No se crea ninguna alerta por la desconexión: en esta versión la desconexión solo cambia `estadoConexion` (el tipo `dispositivo_desconectado` existe en `ALERT_TYPES`, pero no se genera automáticamente). |

## 10. Resumen por incubadora (estado general)

| Caso | Pasos | Resultado esperado |
| ---- | ----- | -------------------- |
| 10.1 | Con dos incubadoras activas, abrir el panel general. | El resumen muestra el total de incubadoras, cuántas están en "Normal", "Advertencia" y "Crítico", y una fila por incubadora con su nombre y su estado. |
| 10.2 | Provocar una alerta solo en la incubadora A. | Solo la fila de A pasa a "Advertencia"; la de B sigue "Normal". Los contadores se actualizan en tiempo real. |
| 10.3 | Desactivar una incubadora (estado "Inactiva"). | Deja de aparecer en el selector y en el resumen del panel. |
| 10.4 | Cambiar el selector "Incubadora" del panel. | Las tarjetas (mediciones, límites, conexión, ventiladores y "Estado general") corresponden a la incubadora elegida; el resumen sigue mostrando todas. |

## 11. Registro de resultados

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
| 9.5 | Prioridad de "Crítico" sobre la alerta activa | | |
| 9.6 | Resumen con una incubadora desconectada | | |
| 9.7 | Reconexión restaura el estado | | |
| 9.8 | Recuperación al reiniciar el servicio | | |
| 9.9 | Servicio detenido: nadie marca la desconexión | | |
| 9.10 | La desconexión no genera alerta | | |
| 10.1 | Resumen con dos incubadoras | | |
| 10.2 | Alerta en una sola incubadora | | |
| 10.3 | Incubadora inactiva fuera del resumen | | |
| 10.4 | Selector de incubadora del panel | | |

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
- La aplicación no ofrece un botón para pasar una alerta a `resuelta`
  (las reglas lo admiten, pero la interfaz solo permite "Marcar como
  reconocida"): el cambio manual en la consola de Firestore de los casos 3.3
  y 6.1 es solo una herramienta de prueba.
- El resumen y el "Estado general" del panel consideran las últimas 200
  alertas leídas: una alerta `activa` más antigua que las 200 más recientes
  (de cualquier estado) no se cuenta. No afecta a las pruebas de este plan.
- Una vez ejecutado el plan, completar la sección 11 y, si algún caso falla,
  abrir una incidencia con el identificador del caso y la evidencia.
