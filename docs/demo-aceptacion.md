# Guion de demostración y aceptación del sistema

## 1. Objetivo

Validar mediante una demostración funcional que el sistema de gestión de incubadoras cumple con los requisitos de autenticación, monitorización, alertas, automatización, control de ventiladores, consulta de históricos, exportación de reportes y auditoría.

**Duración objetivo:** 15 minutos de demostración y 5 minutos para preguntas.

**Participantes:**

- **Presentador 1:** autenticación, usuarios, incubadoras y configuración.
- **Presentador 2:** monitorización, umbrales, alertas, históricos, estadísticas y exportación.
- **Presentador 3:** ventiladores, comandos, automatización y auditoría.

Los presentadores pueden adaptarse según el número de integrantes del equipo.

## 2. Guion por módulos

| Módulo | Responsable | Qué se muestra | Duración | Resultado esperado |
|---|---|---|---|---|
| Autenticación y usuarios | Presentador 1 | Inicio de sesión, permisos de los tres roles, listado y gestión de usuarios. | 1 min 30 s | Cada rol accede únicamente a las funciones autorizadas. |
| Incubadoras | Presentador 1 | Listado de incubadoras, selección y dispositivos asociados. | 1 min | Se identifica una incubadora operativa con sus dispositivos. |
| Monitorización | Presentador 2 | Lecturas de temperatura y humedad actualizadas en tiempo real. | 2 min | Las mediciones se reciben y muestran correctamente. |
| Umbrales y alertas | Presentador 2 | Configuración de umbrales, generación de una alerta y reconocimiento o resolución. | 2 min | Una medición fuera del rango genera la alerta esperada. |
| Históricos, estadísticas y exportación | Presentador 2 | Consulta de mediciones, estadísticas diarias y descarga de CSV y PDF. | 2 min 30 s | Los datos históricos son coherentes y los archivos se pueden abrir. |
| Ventiladores | Presentador 3 | Regla de automatización, orden enviada y estado resultante del ventilador. | 2 min | La acción esperada se ejecuta y su resultado puede verificarse. |
| Auditoría | Presentador 3 | Consulta de eventos, usuario responsable, entidad y fecha. | 1 min 30 s | Las operaciones auditadas pueden consultarse. |
| Configuración y cierre | Presentador 1 | Resumen del entorno, servicios y configuración de la demostración. | 1 min 30 s | Se confirma que los componentes necesarios están preparados. |

**Tiempo estimado de exposición:** 14 minutos. Se reserva aproximadamente un minuto para transiciones e imprevistos, completando los 15 minutos previstos.

## 3. Preparación previa

Completar la lista antes de iniciar la demostración.

### 3.1. Cuentas y permisos

- [ ] Cuenta de administrador creada y verificada.
- [ ] Cuenta de operador creada y verificada.
- [ ] Cuenta de consulta creada y verificada.
- [ ] Acceso probado con cada rol.
- [ ] Permisos de lectura, escritura y administración verificados.
- [ ] Credenciales preparadas de forma segura, sin mostrarlas en pantalla.

### 3.2. Incubadora y dispositivos

- [ ] Existe una incubadora de prueba.
- [ ] Los dispositivos de temperatura y humedad están vinculados a la incubadora.
- [ ] El simulador está funcionando.
- [ ] Se reciben mediciones nuevas.
- [ ] El ventilador de prueba está registrado.
- [ ] Se puede consultar el estado del ventilador.

### 3.3. Históricos y estadísticas

- [ ] Hay suficientes mediciones almacenadas para mostrar un histórico.
- [ ] Los filtros por variable y periodo funcionan.
- [ ] Existen datos para las estadísticas diarias del periodo que se mostrará.
- [ ] Los reportes CSV y PDF se han generado previamente y se pueden abrir.
- [ ] Se ha comprobado que los archivos contienen las columnas y los valores esperados.

### 3.4. Umbrales, reglas y alertas

- [ ] Los umbrales están configurados para el escenario simulado.
- [ ] La regla de automatización corresponde a la condición de prueba.
- [ ] El valor simulado puede activar la regla de manera controlada.
- [ ] La alerta se genera cuando se cumple la condición.
- [ ] Se ha comprobado la recepción del correo de alerta.
- [ ] Se puede reconocer o resolver la alerta según los permisos disponibles.
- [ ] La orden del ventilador se procesa correctamente.

### 3.5. Servicios

- [ ] Frontend disponible.
- [ ] Firestore accesible.
- [ ] Cloud Functions operativas.
- [ ] Simulador conectado.
- [ ] Servicio de correo verificado.
- [ ] Registros revisados para detectar errores previos.

## 4. Recorrido de la demostración

El recorrido debe seguir la misma cadena de eventos en todos los ensayos.

### Paso 1. Medición

**Acción:** iniciar o continuar el simulador y mostrar una nueva lectura de temperatura o humedad.

**Explicación:** el sistema recibe y almacena las mediciones de la incubadora para facilitar su seguimiento.

**Resultado esperado:** la lectura aparece en la interfaz con su valor y fecha.

**Criterio de aceptación:** se observa una actualización de medición sin necesidad de recargar manualmente la vista, cuando el módulo implementa actualización en tiempo real.

### Paso 2. Alerta

**Acción:** generar una lectura que supere el umbral configurado.

**Explicación:** el sistema identifica una condición que requiere atención y registra una alerta.

**Resultado esperado:** aparece la alerta asociada a la incubadora y a la condición detectada.

**Criterio de aceptación:** la alerta corresponde a la variable y al umbral de la prueba. El correo llega al destinatario configurado cuando esa integración está habilitada.

### Paso 3. Automatización

**Acción:** mostrar la regla que responde a la condición detectada.

**Explicación:** las reglas de automatización relacionan una condición con una acción prevista.

**Resultado esperado:** la regla se activa cuando se cumple la condición establecida.

**Criterio de aceptación:** la condición y la acción observadas corresponden a la configuración guardada.

### Paso 4. Comando

**Acción:** mostrar la orden de encendido o apagado que se envía al ventilador.

**Explicación:** el servicio procesa el comando asociado a la regla.

**Resultado esperado:** la orden se registra y su resultado queda disponible para consulta.

**Criterio de aceptación:** se identifica el ventilador destinatario y la acción solicitada.

### Paso 5. Estado

**Acción:** consultar el estado informado por el ventilador o simulador.

**Explicación:** se verifica el resultado de la orden, distinguiendo entre el envío del comando y la confirmación de su ejecución.

**Resultado esperado:** el estado informado corresponde a la acción realizada.

**Criterio de aceptación:** el sistema muestra el estado confirmado por el dispositivo o simulador, o informa claramente si todavía está pendiente.

### Paso 6. Histórico

**Acción:** consultar las mediciones del periodo y las estadísticas disponibles.

**Explicación:** los históricos permiten revisar el comportamiento de la incubadora a lo largo del tiempo.

**Resultado esperado:** se muestran las mediciones y estadísticas correspondientes a los filtros seleccionados.

**Criterio de aceptación:** los datos corresponden a la incubadora, variable y periodo elegidos.

### Paso 7. Exportación

**Acción:** generar y abrir los reportes CSV y PDF.

**Explicación:** los reportes permiten consultar los datos fuera de la aplicación.

**Resultado esperado:** se descargan archivos válidos y legibles.

**Criterio de aceptación:** los archivos contienen la información esperada y, si no existen mediciones, muestran el mensaje previsto para el periodo sin datos.

### Paso 8. Auditoría

**Acción:** acceder con el rol autorizado y consultar los eventos del recorrido.

**Explicación:** la auditoría conserva la trazabilidad de las operaciones que el sistema registra.

**Resultado esperado:** aparecen los eventos que se hayan registrado correctamente durante la demostración.

**Criterio de aceptación:** los eventos disponibles identifican el tipo de acción, la entidad afectada, el usuario responsable y la fecha de registro, sin exponer información sensible.

## 5. Plan B ante fallos

Durante el Sprint 6 - 17 se deben grabar los recorridos que se utilizarán como respaldo.

### 5.1. Evidencias que deben prepararse

- [ ] Inicio de sesión y permisos de los tres roles.
- [ ] Listado de incubadoras y dispositivos.
- [ ] Actualización de mediciones.
- [ ] Generación y gestión de alertas.
- [ ] Ejecución de la regla de automatización.
- [ ] Envío de comandos y verificación del estado.
- [ ] Consulta de históricos y estadísticas.
- [ ] Generación y apertura de CSV y PDF.
- [ ] Consulta de auditoría.

Guardar las evidencias en `docs/evidencias-demo/`, o en la carpeta definida por el equipo. Verificar que los archivos se puedan abrir antes de la presentación.

### 5.2. Procedimiento de recuperación

**Si fallan las mediciones:**

1. Revisar el registro del simulador.
2. Verificar la conexión con el entorno de Firebase.
3. Reiniciar el simulador utilizando el comando definido en el proyecto.
4. Confirmar que llegan nuevas mediciones.

**Si falla el frontend:**

1. Revisar la terminal donde se ejecuta la aplicación.
2. Identificar el error.
3. Reiniciar el frontend con el comando habitual del proyecto.
4. Volver a abrir la aplicación y comprobar la autenticación.

**Si falla una Cloud Function:**

1. Revisar sus registros de ejecución.
2. Comprobar permisos, parámetros y conexión con Firestore.
3. Seguir el procedimiento de recuperación del entorno utilizado.
4. Reanudar la demostración solo cuando se confirme el funcionamiento.

**Si falla el correo de alerta:**

1. Verificar la dirección de destino.
2. Revisar el servicio de correo y sus registros.
3. Comprobar que se haya generado la alerta.
4. Utilizar el video de respaldo si no es posible recuperar el servicio a tiempo.

**Si falla la exportación:**

1. Comprobar el periodo y la cantidad de filas.
2. Revisar los errores de generación del archivo.
3. Intentar generar el reporte con un periodo de prueba más pequeño.
4. Si persiste el error, mostrar el archivo previamente generado y comprobado.

**Si falla la auditoría:**

1. Verificar que la operación principal haya tenido éxito.
2. Revisar los registros de la función que registra el evento.
3. Comprobar que el usuario tenga permiso para consultar la auditoría.
4. Mostrar la evidencia grabada si el problema persiste.

Los comandos exactos de reinicio deben documentarse de acuerdo con los scripts reales del repositorio. Reiniciar servicios locales no garantiza la recuperación de un servicio remoto desplegado.

## 6. Ensayo con cronómetro

Se deben completar al menos dos ensayos de principio a fin.

### Ensayo 1: validación técnica

- [ ] Ejecutar todos los pasos en orden.
- [ ] Medir el tiempo de cada módulo.
- [ ] Confirmar la cadena medición → alerta → automatización → comando → estado.
- [ ] Revisar históricos, estadísticas y exportaciones.
- [ ] Confirmar que los eventos esperados aparezcan en auditoría.
- [ ] Anotar errores y tiempos de espera.

### Ensayo 2: simulación de presentación

- [ ] Repetir el recorrido completo sin interrupciones innecesarias.
- [ ] Mantener el tiempo objetivo de 15 minutos.
- [ ] Comprobar que las transiciones entre presentadores sean claras.
- [ ] Probar al menos una parte del plan B.
- [ ] Ajustar explicaciones que sean demasiado extensas.
- [ ] Confirmar que las evidencias de respaldo estén disponibles.

### Registro de ensayos

| Indicador | Ensayo 1 | Ensayo 2 |
|---|---|---|
| Duración total | Por registrar | Por registrar |
| Autenticación y permisos | Por verificar | Por verificar |
| Medición recibida | Por verificar | Por verificar |
| Alerta generada | Por verificar | Por verificar |
| Automatización ejecutada | Por verificar | Por verificar |
| Comando y estado | Por verificar | Por verificar |
| Histórico y estadísticas | Por verificar | Por verificar |
| CSV y PDF | Por verificar | Por verificar |
| Auditoría | Por verificar | Por verificar |
| Plan B disponible | Por verificar | Por verificar |

## 7. Criterios de aceptación final

La demostración se considera aceptada cuando:

1. Los tres roles respetan los permisos establecidos.
2. Las mediciones se reciben y almacenan correctamente.
3. Una condición de prueba genera la alerta esperada.
4. La regla de automatización ejecuta o solicita la acción prevista.
5. El resultado del comando se puede verificar.
6. Los históricos y las estadísticas corresponden a los datos consultados.
7. Los archivos CSV y PDF son válidos y legibles.
8. Los eventos de auditoría disponibles permiten revisar las operaciones registradas.
9. El equipo dispone de evidencias para el plan B.
10. Se han realizado al menos dos ensayos completos.

### Resultado de aceptación

- [ ] **Aceptado:** se cumplen los criterios acordados.
- [ ] **Aceptado con observaciones:** quedan aspectos menores documentados.
- [ ] **No aceptado:** existen fallos importantes que impiden demostrar los requisitos principales.

**Observaciones:**  
Registrar aquí los fallos encontrados, las correcciones pendientes y la persona responsable de resolverlos.

**Fecha de la demostración:** ____________________

**Responsables:** ____________________

**Firma o aprobación del equipo:** ____________________

## 8. Cierre de la demostración

Mensaje sugerido:

«La demostración permitió revisar el recorrido de los datos desde la medición hasta la respuesta automatizada, así como la consulta de históricos, la generación de reportes y la trazabilidad de las operaciones. Los resultados se evaluaron con base en los criterios de aceptación definidos para cada módulo 
