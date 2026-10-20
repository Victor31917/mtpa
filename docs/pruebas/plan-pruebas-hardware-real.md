# Plan de pruebas de hardware real

## 1. Objetivo

Validar el funcionamiento del dispositivo físico, la comunicación MQTT, el procesamiento de mediciones, las alertas, los comandos y la actualización del dashboard en condiciones reales.

## 2. Requisitos previos

- Dispositivo conectado al sensor de temperatura y, si aplica, al ventilador.
- Acceso autorizado al broker MQTT, al backend y al dashboard.
- Credenciales de prueba individuales por dispositivo.
- Tópicos MQTT y rangos válidos documentados por incubadora.
- Acceso al registro de alertas, auditoría y servicio de correo.
- Relojes del dispositivo, backend y equipo de pruebas sincronizados.
- Entorno seguro para probar desconexiones y temperaturas fuera de rango.

Registrar antes de empezar: fecha, dispositivo, incubadora, versión de firmware, versión del backend, tópico MQTT, frecuencia configurada, latido configurado, límites de temperatura y destinatario de las alertas.

## 3. Casos de prueba

| ID | Prueba y procedimiento | Resultado esperado | Evidencia |
|---|---|---|---|
| HW-01 | Encender el dispositivo y publicar una medición real del sensor. | El valor recibido coincide con el sensor dentro de su tolerancia y aparece en el dashboard. | Lectura física, mensaje MQTT y captura del dashboard. |
| HW-02 | Observar al menos 20 publicaciones consecutivas. | La frecuencia real corresponde a la configuración, dentro de la tolerancia definida. No hay duplicados inesperados ni pérdidas sin registrar. | Marcas de tiempo y cálculo de intervalos. |
| HW-03 | Observar los mensajes de latido durante varios ciclos. | Se reciben con la frecuencia configurada y el dispositivo se identifica correctamente. | Tópico, hora de recepción y logs. |
| HW-04 | En un entorno controlado, generar una temperatura fuera del rango permitido mediante un método de prueba aprobado. | Se crea la alerta correcta, se muestra en el dashboard y se envía el correo al destinatario configurado. | Valor, límites, ID de alerta, correo y tiempos. |
| HW-05 | Cortar la alimentación del dispositivo de prueba y medir el tiempo hasta la alerta de desconexión. | La alerta aparece a los 30 segundos, según la configuración y la última señal válida recibida. | Hora de última señal, hora de alerta y logs. |
| HW-06 | Restaurar la alimentación y esperar la reconexión estable. | El dispositivo vuelve a publicar; la alerta se resuelve según la política de estabilidad configurada y no se crean alertas duplicadas. | Mensajes recibidos, transición de estado e historial. |
| HW-07 | Enviar un comando autorizado de encendido y otro de apagado, si existe ventilador. | El dispositivo recibe el comando y el sistema muestra el estado físico confirmado, no solo el comando solicitado. | ID del comando, ACK, estado físico y dashboard. |
| HW-08 | Con las credenciales del dispositivo A, intentar publicar en el tópico de la incubadora B. | El broker rechaza la publicación o el backend la descarta sin modificar datos de B. | Logs del broker/backend y ausencia de cambios en B. |
| HW-09 | Simular una lectura fallida según el mecanismo admitido por el firmware. | La lectura se marca como inválida; no se interpreta como temperatura normal ni dispara una alerta de temperatura basada en un valor inválido. Se registra el error. | Payload, estado del sensor y logs. |
| HW-10 | Medir el tiempo entre publicación y visualización de la medición. Repetir al menos 10 veces. | La latencia máxima y los percentiles cumplen el objetivo de rendimiento documentado. | Marcas de tiempo de publicación y renderizado. |

## 4. Procedimiento detallado

### HW-01 a HW-03: mediciones, frecuencia y latido

1. Anotar la frecuencia configurada y el intervalo de latido esperado.
2. Iniciar la captura de mensajes MQTT y registrar sus marcas de tiempo.
3. Comparar el valor del sensor con el valor publicado.
4. Calcular los intervalos entre mensajes consecutivos.
5. Verificar que el dashboard actualiza el valor y su fecha de recepción.

Calcular para cada intervalo:

`intervalo = hora_de_recepción_actual - hora_de_recepción_anterior`

Definir previamente una tolerancia para retrasos de red. No asumir que una diferencia pequeña implica pérdida de datos ni que un mensaje duplicado es una medición nueva.

### HW-04: temperatura fuera de rango y correo

1. Confirmar los límites configurados y el destinatario de prueba.
2. Usar un método de ensayo aprobado para el sensor; no exponer una incubadora en uso a condiciones inseguras.
3. Registrar el valor físico y el mensaje recibido.
4. Verificar la creación de una única alerta para el evento.
5. Confirmar la alerta en el dashboard y la recepción del correo.
6. Registrar los tiempos de detección, creación de alerta y entrega del correo.

### HW-05 y HW-06: desconexión y recuperación

1. Registrar la hora de la última señal válida.
2. Cortar la alimentación únicamente al dispositivo de prueba.
3. Comprobar que se genera la alerta de desconexión a los 30 segundos, según la política implementada.
4. Restaurar la alimentación.
5. Esperar mensajes válidos durante el período de estabilidad configurado.
6. Verificar que la alerta cambia a resuelta y que queda constancia en la auditoría.

Registrar por separado el tiempo de detección y el tiempo de resolución; no confundirlos con el tiempo que tarda el dispositivo en arrancar.

### HW-07: comando y estado físico confirmado

1. Confirmar que el dispositivo está conectado y que el ventilador puede accionarse de forma segura.
2. Enviar un comando de encendido desde la interfaz autorizada.
3. Verificar la recepción del comando y una confirmación de ejecución.
4. Verificar el estado físico mediante la señal de realimentación disponible.
5. Repetir para el apagado.
6. Si no existe realimentación física, documentar que solo se confirma la recepción o ejecución informada por firmware, no una verificación independiente del estado real.

### HW-08: credenciales y ACL

1. Identificar dos dispositivos y sus tópicos autorizados.
2. Verificar que cada credencial puede publicar en su propio tópico.
3. Intentar publicar desde el dispositivo A en el tópico de B.
4. Confirmar el rechazo en el broker o el descarte en el backend.
5. Verificar que no cambian las mediciones, alertas ni el estado de la incubadora B.

Un mensaje de error en el cliente no basta por sí solo: confirmar también los logs del broker y la ausencia de cambios en los datos de destino.

### HW-09: lectura fallida

Probar únicamente las condiciones de fallo admitidas por el firmware, por ejemplo, un estado explícito de error o un campo de lectura inválida. No asumir que `0 °C`, `null` o un número arbitrario significan fallo si el protocolo no lo especifica.

El backend debe validar el tipo, el rango físico permitido y el estado de validez antes de actualizar la última medición válida o generar una alerta de temperatura.

### HW-10: latencia hasta la pantalla

1. Sincronizar los relojes involucrados.
2. Capturar la hora de publicación y la hora en que la medición queda visible en el dashboard.
3. Repetir al menos 10 veces con mediciones identificables.
4. Calcular latencia por muestra y latencia máxima.
5. Comparar los resultados con el objetivo de rendimiento del proyecto.

Si los relojes no están sincronizados, medir con un único reloj de referencia o usar trazas correlacionadas; de lo contrario, la latencia calculada puede ser incorrecta.

## 5. Criterios de aceptación

- La medición del dashboard corresponde a la lectura real y muestra su fecha.
- Frecuencia de publicación y latido dentro de la tolerancia aprobada.
- Una temperatura válida fuera de rango genera la alerta y el correo esperados.
- La desconexión se detecta a los 30 segundos según la lógica configurada y se resuelve tras una reconexión estable.
- El estado del ventilador se presenta como confirmado únicamente cuando existe evidencia de realimentación.
- Las ACL impiden modificar los datos de otra incubadora.
- Las lecturas inválidas no se procesan como mediciones válidas.
- La latencia cumple el objetivo documentado.
- Todas las incidencias incluyen logs, horas, dispositivo y resultado observado.

## 6. Registro de resultados

Para cada caso, registrar: ID, fecha/hora, dispositivo, incubadora, configuración, pasos ejecutados, resultado esperado, resultado observado, evidencia, estado (APROBADO/FALLIDO/BLOQUEADO) e incidencia asociada.

No marcar un caso como aprobado sin evidencia verificable.
