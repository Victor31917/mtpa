# Plan de pruebas: históricos y estadísticas

## 1. Objetivo

Validar la consulta de históricos, las gráficas de mediciones, las estadísticas diarias, semanales y mensuales, los permisos de acceso y el comportamiento de la función programada de agregación.

## 2. Preparación

- Tener al menos dos incubadoras con mediciones de prueba.
- Disponer de varias variables, como temperatura y humedad.
- Conocer los umbrales configurados para cada variable.
- Preparar mediciones con fechas conocidas, incluidos días sin datos.
- Identificar los tres roles existentes en el sistema.
- Conocer el límite máximo de registros por consulta.
- Disponer de una función programada que genere o actualice las estadísticas.

## 3. Casos de prueba

| ID | Caso | Resultado esperado |
|---|---|---|
| HE-01 | Consultar un rango con datos | Se muestran las mediciones correspondientes al periodo y a los filtros seleccionados. |
| HE-02 | Consultar un rango sin datos | La interfaz informa claramente que no hay datos y no muestra registros de otros periodos. |
| HE-03 | Consultar un rango que supera el tope | Se muestra un aviso de truncado, se respeta el límite configurado y no se presenta el resultado parcial como si estuviera completo. |
| HE-04 | Cambiar de incubadora | Se actualizan los datos, las estadísticas y la gráfica para la nueva incubadora. No quedan datos de la selección anterior. |
| HE-05 | Cambiar de variable | Se actualizan las unidades, los valores y los umbrales correspondientes a la variable elegida. |
| HE-06 | Gráfica con líneas de umbral | Se visualizan las líneas de umbral configuradas, correctamente identificadas y alineadas con la escala de la variable. |
| HE-07 | Estadística diaria | El resultado coincide con un cálculo manual de las mediciones del día seleccionado. |
| HE-08 | Estadística semanal | El resultado coincide con el cálculo manual de las mediciones de la semana y pondera correctamente por `cantidad`. |
| HE-09 | Estadística mensual | El resultado coincide con el cálculo manual de las mediciones del mes y pondera correctamente por `cantidad`. |
| HE-10 | Aviso «hasta ayer» | Se informa que los datos consolidados llegan hasta el día anterior, si ese es el alcance real del proceso programado. |
| HE-11 | Idempotencia de la función programada | Ejecutar el proceso dos veces no duplica agregados ni altera los resultados correctos. |
| HE-12 | Acceso de los tres roles | Los tres roles autorizados pueden consultar las pantallas conforme a sus permisos. |
| HE-13 | Vista en teléfono | Los filtros, las gráficas, las estadísticas y los avisos se pueden consultar sin desbordamientos ni controles inaccesibles. |

## 4. Validación manual de estadísticas

Para verificar el promedio ponderado de registros agregados, utilizar:

**Promedio ponderado = suma de (promedio × cantidad) / suma de cantidades**

Ejemplo:

| Grupo | Promedio | Cantidad |
|---|---:|---:|
| A | 20 | 2 |
| B | 26 | 3 |

Cálculo manual:

`(20 × 2 + 26 × 3) / (2 + 3) = 23,6`

El resultado debe coincidir con el cálculo del servicio de estadísticas, siempre que ambos grupos correspondan a la misma variable y periodo y que `cantidad` represente el número de observaciones válidas utilizadas para calcular cada promedio.

Para las estadísticas diarias, semanales y mensuales, comprobar además:

- Los límites temporales del periodo.
- La zona horaria usada para agrupar las mediciones.
- La exclusión de mediciones ajenas al periodo.
- El tratamiento de valores nulos o inválidos.
- La definición de los agregados cuando no existen mediciones.

## 5. Validación de la función programada

1. Preparar un conjunto de mediciones conocido.
2. Ejecutar la función programada.
3. Guardar el número de agregados y sus valores.
4. Ejecutar nuevamente la misma función para el mismo periodo.
5. Comparar los resultados y el número de registros.

Criterio de aceptación: la segunda ejecución no debe crear duplicados ni cambiar los resultados correctos.

La implementación debe usar una clave única para cada combinación de incubadora, variable, periodo y granularidad, o una estrategia transaccional equivalente de actualización idempotente.

## 6. Validación de roles y vista móvil

Para cada uno de los tres roles:

- Iniciar sesión con una cuenta de prueba.
- Abrir históricos y estadísticas.
- Cambiar incubadora, variable y periodo.
- Verificar que los datos respeten los permisos de acceso.

En un teléfono o emulador móvil:

- Comprobar la adaptación de los filtros.
- Verificar que las gráficas sean legibles.
- Confirmar que los avisos no oculten información importante.
- Revisar que las tablas permitan consultar los datos sin desbordar toda la página.

## 7. Criterios de aceptación

- [ ] Los rangos con datos y sin datos se muestran correctamente.
- [ ] Se informa cuando una consulta supera el límite.
- [ ] Cambiar incubadora y variable actualiza todos los componentes.
- [ ] Las líneas de umbral corresponden a la configuración seleccionada.
- [ ] Los cálculos diarios, semanales y mensuales coinciden con los cálculos manuales.
- [ ] Los promedios ponderan por `cantidad` cuando corresponde.
- [ ] El aviso «hasta ayer» refleja la fecha real de consolidación.
- [ ] La función programada es idempotente.
- [ ] Los tres roles acceden conforme a sus permisos.
- [ ] La vista móvil funciona correctamente.

## 8. Registro de ejecución

| Campo | Resultado |
|---|---|
| Fecha | Pendiente |
| Pruebas aprobadas | Pendiente |
| Pruebas fallidas | Pendiente |
| Incidencias | Pendiente |
| Resultado final | Pendiente |

## 9. Conclusión

El plan se considera aprobado cuando los resultados consultados coinciden con los datos de origen, los cálculos manuales, las reglas de acceso y los criterios de presentación definidos para escritorio y teléfono.
