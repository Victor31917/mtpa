# Plan de pruebas E2E — Sistema de incubadoras

## 1. Objetivo

Validar los recorridos completos del sistema, desde la generación de mediciones hasta la actualización de pantallas, alertas, comandos, estadísticas, exportaciones y auditoría.

Verificar además la recuperación ante fallos del broker MQTT, reinicios del Servicio de Integración y errores de Cloud Functions.

## 2. Entorno y condiciones previas

- Entorno de pruebas aislado, sin afectar incubadoras de producción.
- Simulador de dispositivos con posibilidad de generar mediciones y detenerse.
- Broker MQTT con credenciales de prueba y acceso a logs.
- Servicio de Integración y Cloud Functions desplegados.
- Correo de pruebas o servidor SMTP de captura.
- Base de datos con acceso a registros de mediciones, órdenes, alertas y auditoría.
- Usuarios de prueba con roles administrador, operador y consulta.
- Dashboard, detalle de incubadora, estado general, históricos, estadísticas y exportación disponibles.
- Relojes sincronizados entre los servicios para poder comparar marcas de tiempo.
- Límites de latencia y recuperación definidos por los requisitos del proyecto.

## 3. Convenciones de medición

Registrar para cada recorrido:

- Hora de inicio y fin.
- Duración total.
- Duración de cada transición.
- Identificadores de medición, alerta, orden y evento de auditoría.
- Resultado esperado y resultado observado.
- Evidencias: capturas, respuestas HTTP, logs y registros persistidos.

No confundir el tiempo de procesamiento interno con el tiempo percibido en pantalla. La latencia visible incluye transporte, persistencia, actualización del frontend y renderizado.

## 4. E2E-01: medición, alerta, correo y resolución automática

**Preparación:** configurar una regla de alerta conocida, un destinatario de correo de prueba y un estado inicial sin alertas abiertas.

1. Publicar una medición que cruce el umbral de alerta.
2. Confirmar que la medición queda persistida.
3. Confirmar que se crea una alerta asociada a la incubadora y a la regla.
4. Verificar que el dashboard muestra la alerta.
5. Abrir el detalle de la incubadora y comprobar el valor, el umbral y el estado.
6. Comprobar el estado general de la incubadora.
7. Confirmar la entrega del correo mediante el proveedor o servidor de captura.
8. Publicar mediciones normales suficientes para cumplir la condición de recuperación.
9. Confirmar la resolución automática de la alerta.
10. Comprobar que el cambio aparece en el dashboard, el detalle y el estado general.
11. Consultar la auditoría.

| Transición | Tiempo inicial | Tiempo final | Duración | Resultado |
|---|---|---|---|---|
| Publicación → persistencia | Pendiente | Pendiente | Pendiente | Pendiente |
| Persistencia → alerta | Pendiente | Pendiente | Pendiente | Pendiente |
| Alerta → correo aceptado por proveedor | Pendiente | Pendiente | Pendiente | Pendiente |
| Recuperación → resolución automática | Pendiente | Pendiente | Pendiente | Pendiente |
| Resolución → interfaz actualizada | Pendiente | Pendiente | Pendiente | Pendiente |

**Aceptación:** la alerta se crea una sola vez según la política configurada, el correo se registra correctamente, la recuperación resuelve la alerta y las pantallas reflejan el estado persistido. Distinguir entre correo aceptado por el proveedor y correo efectivamente recibido.

## 5. E2E-02: regla automática, MQTT e histéresis

1. Configurar una regla de automatización activa.
2. Registrar el estado inicial del ventilador como apagado.
3. Publicar una medición que cruce el umbral de activación.
4. Confirmar la creación de una orden de tipo `automatico` para encender.
5. Verificar la publicación del comando en el tópico MQTT correcto.
6. Confirmar que el dispositivo o simulador recibe y ejecuta el comando.
7. Confirmar el cambio de estado del dispositivo.
8. Verificar que la orden pasa a `ejecutada`.
9. Comprobar que `estadoActual` se actualiza en la pantalla.
10. Publicar valores que permanezcan dentro del margen de histéresis.
11. Confirmar que no se crean órdenes repetidas.
12. Publicar un valor que cruce el umbral de apagado.
13. Confirmar la orden de apagar y el nuevo estado final.

| Comprobación | Resultado esperado |
|---|---|
| Orden creada | Acción y origen correctos |
| Mensaje MQTT | Tópico y payload correctos |
| Confirmación del dispositivo | Recibida y correlacionada con la orden |
| Orden finalizada | `ejecutada` solo tras confirmación válida |
| Estado en pantalla | Coincide con el estado confirmado |
| Histéresis | Sin órdenes innecesarias dentro del margen |

## 6. E2E-03: comando manual con administrador y operador

Ejecutar el recorrido completo con dos sesiones independientes.

1. Iniciar sesión como administrador.
2. Enviar un comando manual permitido.
3. Confirmar autorización, creación de orden, publicación MQTT y confirmación del dispositivo.
4. Verificar estado final y auditoría.
5. Repetir el procedimiento con un operador autorizado.
6. Intentar una acción que exceda los permisos del operador.

**Aceptación:** ambos roles pueden ejecutar únicamente las acciones permitidas. Cada comando se correlaciona con una orden y un usuario, y el estado de la pantalla solo cambia según las confirmaciones reales del dispositivo.

## 7. E2E-04: desconexión y reconexión

1. Confirmar que el simulador está conectado y enviando datos.
2. Detenerlo sin desregistrar el dispositivo.
3. Medir el tiempo desde la última señal válida.
4. Confirmar la alerta de desconexión a los 30 segundos o al tiempo configurado.
5. Verificar dashboard, detalle, estado general y auditoría.
6. Reiniciar el simulador.
7. Confirmar que el dispositivo vuelve a publicar mediciones válidas.
8. Esperar el intervalo de estabilidad configurado.
9. Verificar la resolución de la alerta.
10. Confirmar que no se generan alertas duplicadas ni oscilaciones de estado.

**Aceptación:** la detección respeta el tiempo de desconexión configurado, la recuperación exige la condición de estabilidad establecida y el sistema registra ambas transiciones.

## 8. E2E-05: mediciones, estadísticas, históricos y exportación

1. Generar mediciones mediante los recorridos anteriores.
2. Registrar los identificadores, valores y marcas de tiempo.
3. Consultar las mediciones en el histórico con un rango conocido.
4. Consultar estadísticas diarias y, si aplica, semanales y mensuales.
5. Calcular manualmente los resultados esperados a partir de las mediciones válidas.
6. Exportar el mismo periodo en CSV y PDF.
7. Comparar las filas exportadas con el histórico y los valores de las estadísticas.
8. Verificar filtros, unidades, zona horaria y tratamiento de datos faltantes.

**Aceptación:** los números coinciden con los datos de origen y con las reglas de agregación. Las diferencias de formato entre pantalla y archivo no deben alterar los valores.

## 9. E2E-06: auditoría de extremo a extremo

Consultar los eventos generados por los recorridos E2E-01 a E2E-05.

Comprobar, según la operación:

- Usuario que ejecutó la acción.
- Tipo de acción y recurso afectado.
- Fecha y hora.
- Identificador de correlación.
- Resultado de la operación.
- Cambios de estado relevantes.

**Aceptación:** cada acción auditable aparece una sola vez conforme al modelo de eventos del sistema, con el usuario correcto y sin credenciales, tokens ni secretos.

## 10. E2E-07: resiliencia (RNF-012 y RNF-013)

### A. Interrupción del broker MQTT

1. Mantener el simulador generando mediciones.
2. Registrar la última medición persistida y las órdenes en curso.
3. Interrumpir el broker en el entorno de pruebas.
4. Observar los logs y el estado de los servicios.
5. Restablecer el broker.
6. Verificar la reconexión y el procesamiento posterior.
7. Comprobar las mediciones, órdenes y alertas abiertas.

### B. Reinicio del Servicio de Integración

1. Dejar una orden en curso y una alerta abierta.
2. Reiniciar el Servicio de Integración.
3. Verificar que el proceso vuelve a iniciar correctamente.
4. Comprobar que las órdenes no se ejecutan dos veces.
5. Confirmar que las alertas y mediciones pendientes no se pierden.
6. Verificar la reconciliación de estados tras el reinicio.

### C. Error controlado de Cloud Function

1. Provocar un error de prueba controlado, sin alterar datos de producción.
2. Verificar la respuesta de error y el registro en logs.
3. Confirmar que no se produce un cierre inesperado de los servicios dependientes.
4. Comprobar el tratamiento de reintentos, duplicados y operaciones incompletas.
5. Confirmar que el sistema sigue procesando mediciones posteriores.

**Aceptación:** no hay cierres inesperados, pérdida de mediciones confirmadas ni efectos duplicados. Los errores quedan registrados y los componentes se recuperan según los objetivos definidos en RNF-012 y RNF-013.

## 11. E2E-08: latencia de diez mediciones

1. Sincronizar los relojes o utilizar una fuente de tiempo común.
2. Publicar diez mediciones identificables, separadas por un intervalo conocido.
3. Registrar el instante de publicación de cada medición.
4. Registrar el instante en que cada valor aparece en la pantalla.
5. Correlacionar publicación y visualización mediante el identificador de medición.
6. Calcular la latencia individual y el máximo observado.

\[
L_i = t_{\text{pantalla},i} - t_{\text{publicación},i}
\]

\[
L_{\max} = \max(L_1,\ldots,L_{10})
\]

| N.º | ID medición | Publicación | Visible en pantalla | Latencia (ms) |
|---:|---|---|---|---:|
| 1 | Pendiente | Pendiente | Pendiente | Pendiente |
| 2 | Pendiente | Pendiente | Pendiente | Pendiente |
| 3 | Pendiente | Pendiente | Pendiente | Pendiente |
| 4 | Pendiente | Pendiente | Pendiente | Pendiente |
| 5 | Pendiente | Pendiente | Pendiente | Pendiente |
| 6 | Pendiente | Pendiente | Pendiente | Pendiente |
| 7 | Pendiente | Pendiente | Pendiente | Pendiente |
| 8 | Pendiente | Pendiente | Pendiente | Pendiente |
| 9 | Pendiente | Pendiente | Pendiente | Pendiente |
| 10 | Pendiente | Pendiente | Pendiente | Pendiente |
| **Máximo** | — | — | — | **Pendiente** |

**Aceptación:** las diez mediciones se correlacionan correctamente, no hay valores negativos ni muestras sin explicación y el máximo se compara con el objetivo de latencia definido para el proyecto.

## 12. Registro de ejecución

| Campo | Resultado |
|---|---|
| Fecha | Pendiente |
| Entorno | Pendiente |
| Versión desplegada | Pendiente |
| Responsable | Pendiente |
| Recorridos aprobados | Pendiente |
| Recorridos fallidos | Pendiente |
| Incidencias | Pendiente |
| Latencia máxima | Pendiente |
| Resultado final | Pendiente |

## 13. Conclusión

Los recorridos se consideran aprobados cuando todas las transiciones esperadas se observan en los servicios reales, las pantallas y la auditoría; los fallos se recuperan conforme a los requisitos; y las mediciones y estados persistidos coinciden con los resultados mostrados y exportados.
