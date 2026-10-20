# Plan de pruebas: Configuración del sistema

## 1. Información general

- **Proyecto:** Sistema de gestión de incubadoras.
- **Módulo:** Configuración del sistema.
- **Archivo:** `docs/pruebas/plan-pruebas-configuracion.md`
- **Objetivo:** Verificar el guardado, la validación, los permisos de acceso y el funcionamiento de los parámetros de configuración, incluyendo los tiempos de desconexión, la purga de datos y el registro de auditoría.
- **Responsable:** Equipo de desarrollo y pruebas.
- **Ambiente:** Entorno de pruebas con Firebase, Firestore, frontend, Cloud Functions y simulador de dispositivos.

## 2. Precondiciones

Antes de ejecutar las pruebas, verificar que:

1. El sistema esté desplegado en un entorno de pruebas.
2. Existan usuarios con los roles `administrador`, `operador` y `consulta`.
3. El usuario administrador pueda acceder al módulo de configuración.
4. El simulador de dispositivos esté funcionando y enviando reportes periódicos.
5. Existan mediciones, estadísticas, alertas y órdenes de ventiladores para comprobar los efectos de la purga.
6. La colección o documento de configuración pueda consultarse en Firestore.
7. El módulo de auditoría esté habilitado.
8. Se tenga acceso a los registros de ejecución del frontend y de las funciones del servidor.

**Importante:** Ejecutar las pruebas de purga únicamente en un entorno controlado, con datos de prueba y copias de seguridad cuando corresponda.

## 3. Casos de prueba

### CP-CONF-001. Guardar valores válidos

**Objetivo:** Verificar que el administrador pueda guardar una configuración con valores válidos.

**Pasos:**

1. Iniciar sesión como administrador.
2. Abrir el menú de configuración.
3. Introducir valores válidos para el intervalo de reporte y el tiempo de retención.
4. Guardar los cambios.
5. Volver a consultar la configuración guardada en Firestore.
6. Recargar la pantalla y comprobar que los valores continúan visibles.

**Resultado esperado:**

- El sistema acepta los valores válidos.
- La configuración se guarda correctamente.
- Los valores se mantienen después de recargar la pantalla.
- Se genera el evento de auditoría correspondiente.

### CP-CONF-002. Rechazar una retención menor a 12

**Objetivo:** Comprobar que el sistema no permita aplicar una retención inferior al mínimo establecido.

**Pasos:**

1. Iniciar sesión como administrador.
2. Abrir la configuración.
3. Introducir una retención de 11 meses.
4. Intentar guardar los cambios.
5. Revisar el mensaje mostrado y el valor almacenado.

**Resultado esperado:**

- El formulario rechaza el valor o lo normaliza a 12, según el comportamiento definido.
- El sistema nunca aplica una retención inferior a 12 meses.
- Si el valor se normaliza, la configuración efectiva debe ser de 12 meses.
- No se ejecuta una purga con una retención inferior al mínimo.

**Nota:** Si la implementación establece que los valores menores a 12 se tratan como 12, verificar específicamente ese comportamiento en el caso CP-CONF-011.

### CP-CONF-003. Rechazar un intervalo fuera de rango

**Objetivo:** Verificar que el intervalo de reporte respete los límites definidos por el proyecto.

**Pasos:**

1. Iniciar sesión como administrador.
2. Abrir la configuración.
3. Introducir un intervalo inferior al mínimo permitido.
4. Intentar guardar.
5. Repetir la prueba con un intervalo superior al máximo permitido.
6. Consultar el valor guardado en Firestore.

**Resultado esperado:**

- El sistema rechaza los valores que están fuera del rango configurado.
- Se informa al usuario que el intervalo no es válido.
- No se guarda ni se aplica un intervalo fuera de los límites.
- La configuración anterior permanece intacta si el guardado es rechazado.

**Observación:** Registrar el mínimo y el máximo reales definidos por la implementación. No asumir límites numéricos sin verificarlos en el código.

### CP-CONF-004. Rechazar valores decimales

**Objetivo:** Comprobar que los parámetros que requieren números enteros no acepten decimales.

**Pasos:**

1. Iniciar sesión como administrador.
2. Abrir la configuración.
3. Introducir un valor decimal en el campo de intervalo.
4. Intentar guardar.
5. Repetir la prueba con el campo de retención.
6. Consultar los valores almacenados.

**Resultado esperado:**

- Los campos que requieren enteros rechazan los valores decimales.
- El sistema no redondea ni trunca silenciosamente los valores.
- No se guarda una configuración inválida.
- Se muestra un mensaje de validación comprensible.

### CP-CONF-005. Solo el administrador puede acceder y escribir

**Objetivo:** Verificar los permisos de los tres roles del sistema.

**Pasos:**

1. Iniciar sesión como administrador y abrir la configuración.
2. Comprobar que puede consultar y modificar los parámetros.
3. Cerrar sesión e ingresar como operador.
4. Intentar consultar la configuración y modificarla.
5. Repetir el procedimiento con el rol de consulta.
6. Intentar modificar los datos mediante la interfaz y comprobar que las operaciones directas contra Firestore también estén protegidas.

**Resultado esperado:**

- **Administrador:** puede consultar y modificar la configuración.
- **Operador:** puede consultar los valores si así lo define el sistema, pero no modificarlos.
- **Consulta:** puede consultar los valores si así lo define el sistema, pero no modificarlos.
- Los roles no autorizados no pueden escribir directamente en Firestore.
- La seguridad no depende únicamente de ocultar botones en la interfaz.

### CP-CONF-006. Cambiar el intervalo sin reiniciar el servicio

**Objetivo:** Verificar que un cambio de intervalo se aplique mientras el servicio está funcionando.

**Pasos:**

1. Iniciar el simulador y confirmar que los dispositivos están reportando.
2. Consultar el intervalo de reporte configurado.
3. Registrar el comportamiento actual de detección de desconexiones.
4. Cambiar el intervalo desde la configuración con el usuario administrador.
5. Guardar los cambios sin reiniciar el frontend, las Cloud Functions ni el servicio que supervisa las desconexiones.
6. Detener el simulador de un dispositivo de prueba.
7. Medir el tiempo transcurrido hasta que el sistema detecta la desconexión y genera la alerta.
8. Repetir la prueba con otro intervalo válido.
9. Consultar los registros para confirmar que el nuevo parámetro fue aplicado.

**Resultado esperado:**

- El nuevo intervalo se aplica sin reiniciar los servicios.
- El tiempo de detección de desconexión cambia de acuerdo con la configuración y la lógica implementada.
- La alerta se genera dentro del tiempo esperado por los criterios del sistema.
- No se generan alertas duplicadas por un mismo evento.
- El tiempo medido queda registrado en la evidencia de la prueba.

**Registro de mediciones:**

| Prueba | Intervalo anterior | Intervalo nuevo | Hora de detención | Hora de alerta | Tiempo transcurrido |
|---|---|---|---|---|---|
| 1 | _____ | _____ | _____ | _____ | _____ |
| 2 | _____ | _____ | _____ | _____ | _____ |
| 3 | _____ | _____ | _____ | _____ | _____ |

**Criterio de evaluación:** No asumir que el tiempo de desconexión es exactamente igual al intervalo configurado. Depende de la lógica de supervisión, los tiempos de espera y la frecuencia con que se ejecuta la comprobación.

### CP-CONF-007. Comportamiento cuando no existe documento de configuración

**Objetivo:** Verificar que el sistema conserve el comportamiento anterior cuando no existe un documento de configuración.

**Pasos:**

1. Utilizar un entorno de pruebas.
2. Confirmar que no existe el documento de configuración esperado.
3. Iniciar el servicio de supervisión y el simulador.
4. Detener el simulador de un dispositivo.
5. Medir el tiempo hasta la detección de la desconexión.
6. Revisar los registros del servicio.

**Resultado esperado:**

- El sistema utiliza el valor predeterminado de **30 segundos**.
- El servicio continúa funcionando sin errores.
- La ausencia del documento no impide la supervisión de los dispositivos.
- El comportamiento predeterminado queda documentado en los registros o en la evidencia.

### CP-CONF-008. Purga desactivada

**Objetivo:** Verificar que no se eliminen datos cuando la purga está desactivada.

**Pasos:**

1. Preparar datos de prueba antiguos y recientes.
2. Registrar la cantidad de documentos en las colecciones que podrían verse afectadas.
3. Desactivar la purga desde la configuración.
4. Ejecutar el mecanismo de purga o esperar su ejecución programada.
5. Consultar nuevamente las colecciones.
6. Comparar los resultados con el registro inicial.

**Resultado esperado:**

- No se eliminan documentos por efecto de la purga.
- Los registros antiguos y recientes permanecen intactos.
- El servicio puede ejecutarse sin errores aunque la purga esté desactivada.

### CP-CONF-009. Purga activa elimina solo los datos anteriores al corte

**Objetivo:** Verificar que la purga elimine únicamente los datos que superan el periodo de retención.

**Pasos:**

1. Activar la purga en el entorno de pruebas.
2. Configurar un periodo de retención válido.
3. Crear o identificar documentos con fechas anteriores al corte.
4. Crear o identificar documentos con fechas posteriores al corte.
5. Registrar los documentos y las cantidades iniciales.
6. Ejecutar la purga.
7. Consultar nuevamente las colecciones afectadas.
8. Comparar los documentos restantes con los datos iniciales.

**Resultado esperado:**

- Se eliminan únicamente los documentos que cumplen la condición de antigüedad definida.
- Los documentos posteriores al corte permanecen intactos.
- Los registros situados exactamente en la fecha de corte se tratan de acuerdo con la regla documentada.
- La purga no elimina documentos ajenos a las colecciones autorizadas.

**Registro de resultados:**

| Colección | Documentos antes | Documentos eliminados | Documentos después | Resultado |
|---|---:|---:|---:|---|
| Mediciones | _____ | _____ | _____ | _____ |
| Otras colecciones sujetas a purga | _____ | _____ | _____ | _____ |

### CP-CONF-010. La purga conserva estadísticas, alertas y órdenes

**Objetivo:** Comprobar que la purga no elimine estadísticas, alertas ni órdenes de ventiladores.

**Pasos:**

1. Preparar datos antiguos en las colecciones sujetas a purga.
2. Crear o identificar documentos de prueba en `estadisticas_diarias`, `alertas` y `ordenes_ventilador`.
3. Registrar los identificadores de esos documentos.
4. Activar y ejecutar la purga.
5. Consultar nuevamente las tres colecciones.
6. Verificar que los documentos identificados sigan existiendo.

**Resultado esperado:**

- Los documentos de `estadisticas_diarias` permanecen intactos.
- Los documentos de `alertas` permanecen intactos.
- Los documentos de `ordenes_ventilador` permanecen intactos.
- Solo se eliminan los datos de las colecciones expresamente autorizadas para purga.

### CP-CONF-011. Normalizar una retención inferior a 12 meses

**Objetivo:** Verificar que una retención menor al mínimo se trate como 12 meses.

**Pasos:**

1. En el entorno de pruebas, establecer una retención inferior a 12 mediante el mecanismo disponible para simular una configuración inválida.
2. Ejecutar la lectura y validación de la configuración.
3. Consultar el valor efectivo que utiliza la purga.
4. Verificar el cálculo de la fecha de corte.
5. Comprobar que no se eliminen documentos que todavía están dentro del periodo mínimo de retención.

**Resultado esperado:**

- El valor efectivo de retención es de al menos 12 meses.
- El cálculo del corte utiliza el mínimo de 12 meses.
- Los datos que no cumplen el criterio de antigüedad no se eliminan.
- La normalización se aplica también en el servidor, no solamente en el formulario del frontend.

**Nota:** Si la configuración inválida se rechaza antes de guardarse, probar la normalización en la función que calcula la retención efectiva, sin modificar datos de producción.

### CP-CONF-012. Cada cambio genera un evento de auditoría

**Objetivo:** Verificar que cada modificación de parámetros quede registrada.

**Pasos:**

1. Iniciar sesión como administrador.
2. Modificar el intervalo de reporte y guardar.
3. Consultar la colección `auditoria`.
4. Identificar el evento correspondiente al cambio.
5. Modificar el periodo de retención y guardar.
6. Consultar nuevamente la auditoría.
7. Repetir la prueba con el parámetro de purga, si está disponible.
8. Revisar el tipo de evento, el usuario y la fecha.

**Resultado esperado:**

- Cada cambio exitoso genera su evento de auditoría.
- El evento identifica al usuario que realizó la modificación.
- Se registra la fecha y hora del cambio.
- El detalle permite identificar el parámetro modificado sin incluir información sensible.
- Los intentos rechazados no se registran como cambios exitosos.
- La auditoría no permite escrituras directas no autorizadas desde el cliente.

**Datos que se deben verificar:**

- `tipoEvento`
- `entidadAfectada`
- `usuarioId`
- `detalle`
- `ocurridoEn`

**Nota técnica:** Confirmar el tipo de evento que utiliza la implementación para los cambios de configuración. Si se usa un evento genérico, documentarlo de forma consistente.

### CP-CONF-013. El menú no muestra una opción de idioma

**Objetivo:** Confirmar que el menú de configuración no presente una opción de cambio de idioma cuando esta funcionalidad no está implementada.

**Pasos:**

1. Iniciar sesión como administrador.
2. Abrir el menú principal y el módulo de configuración.
3. Revisar las opciones visibles.
4. Repetir la comprobación con los roles operador y consulta.
5. Recorrer la interfaz y verificar que no exista un selector de idioma funcional.

**Resultado esperado:**

- El menú no muestra una opción para cambiar el idioma.
- La interfaz permanece en español.
- No aparece un control que permita seleccionar un idioma que el sistema todavía no soporta.

## 4. Registro de ejecución

Completar la siguiente tabla después de ejecutar las pruebas.

| ID | Caso de prueba | Resultado obtenido | Estado | Evidencia |
|---|---|---|---|---|
| CP-CONF-001 | Guardar valores válidos | _____ | Pendiente | _____ |
| CP-CONF-002 | Retención menor a 12 | _____ | Pendiente | _____ |
| CP-CONF-003 | Intervalo fuera de rango | _____ | Pendiente | _____ |
| CP-CONF-004 | Valores decimales | _____ | Pendiente | _____ |
| CP-CONF-005 | Permisos por rol | _____ | Pendiente | _____ |
| CP-CONF-006 | Cambio de intervalo sin reinicio | _____ | Pendiente | _____ |
| CP-CONF-007 | Ausencia del documento | _____ | Pendiente | _____ |
| CP-CONF-008 | Purga desactivada | _____ | Pendiente | _____ |
| CP-CONF-009 | Purga activa y fecha de corte | _____ | Pendiente | _____ |
| CP-CONF-010 | Conservación de estadísticas, alertas y órdenes | _____ | Pendiente | _____ |
| CP-CONF-011 | Normalización de retención | _____ | Pendiente | _____ |
| CP-CONF-012 | Auditoría de cambios | _____ | Pendiente | _____ |
| CP-CONF-013 | Ausencia de opción de idioma | _____ | Pendiente | _____ |

Estados permitidos:

- **Aprobado:** el resultado coincide con el esperado.
- **Fallido:** el resultado no coincide con el esperado.
- **Bloqueado:** no se pudo ejecutar por una dependencia o problema del entorno.
- **Pendiente:** todavía no se ha ejecutado.

## 5. Evidencias

Guardar las evidencias de ejecución en:

`docs/pruebas/evidencias/configuracion/`

Se recomienda incluir:

- Capturas de pantalla de los valores válidos e inválidos.
- Capturas de los permisos de cada rol.
- Registros con los tiempos de detección de desconexión.
- Evidencias de la configuración predeterminada de 30 segundos.
- Conteos o identificadores de documentos antes y después de la purga.
- Evidencia de conservación de estadísticas, alertas y órdenes.
- Eventos de auditoría correspondientes a los cambios.
- Captura del menú sin la opción de idioma.
- Mensajes de error o registros del servidor cuando una prueba falle.

No incluir contraseñas, tokens ni otros datos sensibles en las evidencias.

## 6. Criterios de aceptación

El módulo de configuración se considera aprobado cuando:

- [ ] Se guardan los valores válidos.
- [ ] Se rechazan los intervalos fuera de rango y los decimales no permitidos.
- [ ] La retención efectiva nunca es inferior a 12 meses.
- [ ] Solo el administrador puede modificar la configuración.
- [ ] Los cambios de intervalo se aplican sin reiniciar los servicios.
- [ ] La ausencia del documento conserva el valor predeterminado de 30 segundos.
- [ ] La purga desactivada no elimina datos.
- [ ] La purga activa elimina solo los datos autorizados anteriores al corte.
- [ ] Las estadísticas, alertas y órdenes permanecen intactas.
- [ ] Cada cambio exitoso de parámetro genera un evento de auditoría.
- [ ] El menú no muestra una opción de idioma.
- [ ] Las pruebas cuentan con resultados y evidencias verificables.

## 7. Observaciones finales

Registrar los defectos encontrados, la fecha de corrección y el resultado de la repetición de cada prueba fallida.

No marcar un caso como aprobado únicamente porque la interfaz muestre un mensaje de éxito. Verificar también el valor persistido, los permisos del servidor y los efectos reales de cada operación.

Las pruebas de purga deben realizarse con datos controlados. Antes de habilitar la eliminación automática en producción, confirmar las colecciones autorizadas, el cálculo de la fecha de corte, la paginación y la protección contra eliminaciones accidentales.
