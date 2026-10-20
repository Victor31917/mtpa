# Plan de pruebas: hardware real

## 1. Información general

- **Proyecto:** Sistema de gestión y monitorización de incubadoras.
- **Documento:** Plan de pruebas con hardware real.
- **Ruta:** `docs/pruebas/plan-pruebas-hardware-real.md`
- **Fecha de elaboración:** 20/10/2026.
- **Responsable:** Equipo de desarrollo y pruebas.
- **Entorno:** Hardware físico y servicios del sistema.
- **Estado:** Pendiente de ejecución.

## 2. Objetivo

Validar el comportamiento del sistema cuando se conecta a dispositivos físicos, comprobar que los intervalos de reporte estén configurados correctamente, detectar posibles falsas desconexiones y verificar el flujo de control del ventilador real, si está disponible.

También se documentarán las diferencias entre el simulador y el hardware en cuanto a formatos de mensajes, tiempos de comunicación, reconexión y actualización de estados.

## 3. Alcance

Las pruebas cubrirán los siguientes aspectos:

1. Repetición de casos fallidos o bloqueados durante la primera ronda.
2. Medición del intervalo real entre reportes del dispositivo.
3. Verificación del intervalo de tolerancia para detectar desconexiones.
4. Prueba de un intervalo configurado demasiado bajo y observación de posibles falsas desconexiones.
5. Envío de un comando al ventilador físico y confirmación de su estado, si existe hardware disponible.
6. Comparación del comportamiento del simulador y del dispositivo real.
7. Registro de incidencias, evidencias y ajustes recomendados.

## 4. Condiciones previas

Antes de comenzar, verificar:

- [ ] El dispositivo físico está instalado y conectado correctamente.
- [ ] La fuente de alimentación es estable y adecuada para el dispositivo.
- [ ] La conexión de red o comunicación está operativa.
- [ ] El sistema puede recibir mensajes del dispositivo.
- [ ] El dispositivo tiene un identificador registrado en el sistema.
- [ ] Se conoce el intervalo configurado de reporte o envío de latidos.
- [ ] Se puede consultar la hora de recepción de cada mensaje.
- [ ] El panel muestra el estado actual del dispositivo.
- [ ] Se tiene acceso a los registros necesarios para investigar fallos.
- [ ] Las pruebas se realizan en un entorno controlado y autorizado.

Si se utiliza un ventilador físico, verificar adicionalmente que la instalación sea segura y que el dispositivo pueda probarse sin poner en riesgo personas, equipos ni el entorno de incubación.

## 5. Registro del hardware utilizado

| Campo | Información |
|---|---|
| Tipo de dispositivo | Pendiente |
| Fabricante y modelo | Pendiente |
| Identificador registrado | Pendiente |
| Versión de firmware | Pendiente |
| Método de comunicación | Pendiente |
| Intervalo de reporte configurado | Pendiente |
| Intervalo de latido configurado | Pendiente |
| Umbral de desconexión configurado | Pendiente |
| Fecha de la prueba | Pendiente |
| Responsable | Pendiente |

No registrar contraseñas, claves privadas ni tokens en este documento.

## 6. Primera ronda: repetición de pruebas fallidas o bloqueadas

### 6.1 Objetivo

Repetir los casos de prueba que quedaron fallidos o bloqueados durante la primera ronda, verificando si los problemas continúan presentes en el entorno con hardware real.

### 6.2 Procedimiento

1. Consultar el informe de la primera ronda de pruebas.
2. Identificar los casos marcados como fallidos o bloqueados.
3. Registrar el motivo de cada fallo o bloqueo.
4. Confirmar que las correcciones necesarias estén desplegadas.
5. Preparar el dispositivo y el entorno físico.
6. Ejecutar nuevamente cada caso utilizando las mismas condiciones de prueba cuando sea posible.
7. Comparar el resultado nuevo con el resultado original.
8. Registrar las diferencias y adjuntar las evidencias.

### 6.3 Registro de casos repetidos

| ID del caso original | Motivo del fallo o bloqueo | Resultado de la repetición | Evidencia | Estado |
|---|---|---|---|---|
| Por completar | Por completar | Pendiente | Por completar | Pendiente |
| Por completar | Por completar | Pendiente | Por completar | Pendiente |
| Por completar | Por completar | Pendiente | Por completar | Pendiente |

**Criterio de aceptación:** cada caso debe quedar aprobado, fallido o bloqueado con una explicación. No se deben eliminar los fallos anteriores del historial de pruebas.

## 7. Medición del período real de reporte

### 7.1 Objetivo

Medir el tiempo real entre mensajes consecutivos enviados por el dispositivo y determinar si el intervalo configurado para detectar desconexiones es adecuado.

### 7.2 Procedimiento

1. Iniciar el dispositivo físico y esperar a que se estabilice la comunicación.
2. Confirmar que el sistema registra correctamente los mensajes.
3. Recopilar al menos 30 intervalos consecutivos de reporte, si el dispositivo lo permite.
4. Registrar las marcas temporales de recepción con la mayor precisión disponible.
5. Calcular la diferencia entre cada par de mensajes consecutivos.
6. Obtener el intervalo mínimo, el promedio y el máximo observado.
7. Identificar retrasos o variaciones de comunicación.
8. Comparar los resultados con el intervalo configurado en el sistema.

Se recomienda utilizar las marcas temporales de recepción registradas por el servidor para evaluar cuándo el sistema recibe efectivamente los mensajes. Si también existen marcas temporales del dispositivo, registrar ambas para distinguir retrasos de red de variaciones del propio dispositivo.

### 7.3 Fórmula de cálculo

Para dos mensajes consecutivos:

\[
\Delta t_i = t_i - t_{i-1}
\]

Donde:

- \(t_i\): instante de recepción del mensaje actual.
- \(t_{i-1}\): instante de recepción del mensaje anterior.
- \(\Delta t_i\): intervalo observado entre mensajes.

Calcular también el promedio:

\[
\overline{\Delta t} =
\frac{1}{n}\sum_{i=1}^{n}\Delta t_i
\]

### 7.4 Tabla de mediciones

| N.º | Hora de recepción | Intervalo observado (s) | Observaciones |
|---:|---|---:|---|
| 1 | Por completar | — | Primer mensaje |
| 2 | Por completar | Por calcular | Por completar |
| 3 | Por completar | Por calcular | Por completar |
| 4 | Por completar | Por calcular | Por completar |
| 5 | Por completar | Por calcular | Por completar |
| 6–30 | Completar durante la prueba | Por calcular | Por completar |

### 7.5 Resumen de resultados

| Métrica | Resultado |
|---|---|
| Número de intervalos medidos | Pendiente |
| Intervalo mínimo observado | Pendiente |
| Intervalo promedio observado | Pendiente |
| Intervalo máximo observado | Pendiente |
| Intervalo de reporte documentado por el fabricante | Pendiente |
| Intervalo configurado en el sistema | Pendiente |
| Umbral de desconexión configurado | Pendiente |

**Criterio de aceptación:** el intervalo de detección debe tener en cuenta el período real de reporte, la variación observada y los retrasos razonables de comunicación. No basta con que el umbral sea mayor que el promedio; también debe tolerar variaciones normales sin ocultar desconexiones reales durante un tiempo excesivo.

## 8. Prueba de intervalo demasiado bajo y falsa desconexión

### 8.1 Objetivo

Comprobar si un umbral de desconexión demasiado bajo provoca que un dispositivo operativo aparezca incorrectamente como desconectado.

### 8.2 Procedimiento

1. Registrar la configuración inicial del período de reporte y del umbral de desconexión.
2. Confirmar que el dispositivo envía mensajes regularmente y aparece conectado.
3. En un entorno de pruebas, reducir temporalmente el umbral de desconexión a un valor inferior al período normal de reporte.
4. Mantener el dispositivo funcionando y observar el estado en el panel.
5. Registrar cada transición entre conectado y desconectado.
6. Comparar las transiciones con los mensajes recibidos.
7. Restaurar el valor de configuración adecuado.
8. Repetir la observación y comprobar si desaparecen las falsas desconexiones.

**Precaución:** realizar esta prueba en un entorno controlado. No modificar el umbral de un sistema de producción ni de una incubadora que dependa de la monitorización para mantener condiciones críticas.

### 8.3 Resultado esperado

- Con un umbral demasiado bajo, se puede reproducir una falsa desconexión si los mensajes llegan después del límite configurado.
- El dispositivo debe volver a marcarse conectado cuando el sistema reciba un mensaje válido, de acuerdo con las reglas de reconexión implementadas.
- Tras restaurar una configuración adecuada, no deben aparecer falsas desconexiones durante el período normal observado.

### 8.4 Registro de la prueba

| Parámetro | Valor |
|---|---|
| Intervalo de reporte observado | Pendiente |
| Umbral de desconexión inicial | Pendiente |
| Umbral reducido durante la prueba | Pendiente |
| ¿Se produjo falsa desconexión? | Pendiente |
| Tiempo hasta la falsa desconexión | Pendiente |
| Umbral restaurado | Pendiente |
| ¿Desapareció el problema? | Pendiente |

**Criterio de aceptación:** se documenta el efecto del umbral demasiado bajo y se identifica una configuración que tolere las variaciones normales del dispositivo sin demorar excesivamente la detección de una desconexión real.

## 9. Prueba del ventilador físico

Esta sección se ejecutará únicamente si hay un ventilador real conectado y disponible para pruebas.

### 9.1 Objetivo

Verificar el recorrido completo desde el envío de un comando manual hasta la confirmación del estado real del ventilador.

### 9.2 Procedimiento

1. Verificar que el ventilador esté instalado de forma segura.
2. Confirmar que el dispositivo aparezca conectado en el sistema.
3. Registrar el estado inicial del ventilador.
4. Enviar un comando permitido desde la aplicación.
5. Confirmar que el backend acepte y procese el comando.
6. Verificar que el dispositivo físico reciba el comando.
7. Observar el comportamiento físico del ventilador.
8. Consultar el estado confirmado por el dispositivo o el mecanismo de retroalimentación disponible.
9. Comparar el estado físico con el estado mostrado en el panel.
10. Registrar los tiempos de envío, recepción, ejecución y confirmación.

### 9.3 Resultados esperados

- El comando se envía al dispositivo correcto.
- El dispositivo procesa el comando.
- El ventilador responde conforme a la acción solicitada.
- El sistema distingue entre un comando enviado y un estado efectivamente confirmado.
- El panel refleja el estado confirmado cuando existe retroalimentación del hardware.
- Los errores de comunicación se registran y no se presentan como ejecuciones exitosas.

**Importante:** si el hardware no ofrece confirmación del estado, documentar esa limitación. La aceptación de un comando por el backend no demuestra por sí sola que el ventilador haya ejecutado la acción.

### 9.4 Registro del ventilador

| Campo | Resultado |
|---|---|
| Hardware disponible | Pendiente |
| Estado inicial | Pendiente |
| Comando enviado | Pendiente |
| Hora de envío | Pendiente |
| Hora de recepción por el dispositivo | Pendiente |
| Hora de ejecución física | Pendiente |
| Hora de confirmación | Pendiente |
| Estado físico observado | Pendiente |
| Estado mostrado en el panel | Pendiente |
| Resultado final | Pendiente |

Si no hay ventilador real disponible, marcar esta prueba como **Bloqueada** e indicar el motivo.

## 10. Comparación entre simulador y hardware real

### 10.1 Objetivo

Identificar las diferencias entre el simulador y el dispositivo físico que puedan afectar el funcionamiento del sistema.

### 10.2 Matriz comparativa

| Aspecto | Simulador | Hardware real | Diferencia o impacto |
|---|---|---|---|
| Formato de mensajes | Por registrar | Por registrar | Por analizar |
| Frecuencia de reporte | Por registrar | Por medir | Por analizar |
| Marcas temporales | Por registrar | Por registrar | Por analizar |
| Variación de los intervalos | Por registrar | Por medir | Por analizar |
| Latencia de comunicación | Por medir | Por medir | Por analizar |
| Pérdida de mensajes | Por verificar | Por verificar | Por analizar |
| Detección de desconexión | Por verificar | Por verificar | Por analizar |
| Tiempo de reconexión | Por medir | Por medir | Por analizar |
| Recuperación después de perder conexión | Por verificar | Por verificar | Por analizar |
| Confirmación del estado del ventilador | Por verificar | Por verificar | Por analizar |
| Comportamiento ante errores | Por verificar | Por verificar | Por analizar |

### 10.3 Formato de mensajes

Verificar que los mensajes del hardware respeten el formato esperado por el backend:

- Identificador del dispositivo.
- Identificador de incubadora, cuando corresponda.
- Variable medida.
- Valor y unidad.
- Marca temporal, si aplica.
- Datos de estado o latido, según el protocolo implementado.

Registrar cualquier diferencia de nombres de campos, unidades, tipos de datos, estructura del mensaje o codificación.

### 10.4 Tiempos y reconexión

1. Medir el intervalo entre mensajes del simulador.
2. Medir el intervalo entre mensajes del hardware.
3. Comparar los máximos observados.
4. Interrumpir y restaurar la comunicación en condiciones controladas.
5. Registrar cuánto tarda el dispositivo en volver a enviar mensajes.
6. Comprobar cuándo el sistema lo marca nuevamente como conectado.
7. Verificar que no se creen registros duplicados ni estados contradictorios durante la reconexión.

**Criterio de aceptación:** las diferencias identificadas quedan documentadas y los parámetros de monitoreo son adecuados para el comportamiento real del dispositivo.

## 11. Registro de incidencias

Guardar las evidencias en una carpeta como:

`docs/pruebas/evidencias/hardware-real/`

Convención sugerida para las capturas y registros:

- `HW-001-prueba-fallida.png`
- `HW-002-intervalos-reporte.csv`
- `HW-003-falsa-desconexion.png`
- `HW-004-comando-ventilador.png`
- `HW-005-reconexion.png`

| ID | Prueba | Descripción de la incidencia | Evidencia | Responsable | Estado |
|---|---|---|---|---|---|
| HW-001 | Repetición de casos | Pendiente | Pendiente | Pendiente | Pendiente |
| HW-002 | Intervalo de reporte | Pendiente | Pendiente | Pendiente | Pendiente |
| HW-003 | Falsa desconexión | Pendiente | Pendiente | Pendiente | Pendiente |
| HW-004 | Ventilador físico | Pendiente | Pendiente | Pendiente | Pendiente |
| HW-005 | Reconexión | Pendiente | Pendiente | Pendiente | Pendiente |

No incluir contraseñas, claves privadas, tokens ni datos sensibles en las capturas o registros.

## 12. Criterios de aceptación finales

- [ ] Se repitieron todos los casos fallidos o bloqueados de la primera ronda.
- [ ] Se midió el período real de reporte del dispositivo.
- [ ] Se registraron los intervalos mínimo, promedio y máximo observados.
- [ ] Se verificó la relación entre el intervalo real y el umbral de desconexión.
- [ ] Se evaluó el efecto de un intervalo demasiado bajo.
- [ ] Se documentaron las falsas desconexiones observadas.
- [ ] Se restauró una configuración adecuada después de la prueba.
- [ ] Se probó el flujo de comando y estado confirmado del ventilador, si había hardware disponible.
- [ ] Se documentaron las diferencias entre el simulador y el hardware.
- [ ] Se registraron los tiempos de reconexión.
- [ ] Se adjuntaron las evidencias de las pruebas.
- [ ] Las incidencias pendientes tienen responsable y plan de corrección.

## 13. Resumen de ejecución

- **Fecha de ejecución:** Pendiente.
- **Responsable:** Pendiente.
- **Modelo del hardware:** Pendiente.
- **Casos repetidos y aprobados:** Pendiente.
- **Intervalo de reporte medido:** Pendiente.
- **Umbral de desconexión validado:** Pendiente.
- **Falsas desconexiones detectadas:** Pendiente.
- **Ventilador físico probado:** Pendiente.
- **Diferencias relevantes con el simulador:** Pendiente.
- **Incidencias abiertas:** Pendiente.
- **Resultado final:** Pendiente de ejecución.

## 14. Conclusión

Este plan permite validar el comportamiento del sistema con hardware real y detectar diferencias que no siempre se reproducen en un simulador. La aprobación requiere resultados medidos, evidencias verificables y una configuración de monitoreo adecuada para los intervalos reales de comunicación del dispositivo.
