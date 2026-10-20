# Matriz de aceptación del sistema

## 1. Información general

- **Proyecto:** Sistema de gestión de incubadoras.
- **Documento:** Matriz de aceptación.
- **Archivo:** `docs/pruebas/matriz-aceptacion.md`
- **Documento de referencia:** Especificación de Requisitos del Software (ERS).
- **Responsable de las pruebas:** ____________________
- **Fecha de ejecución:** ____________________
- **Versión evaluada:** ____________________

### Objetivo

Relacionar cada requisito del ERS con la funcionalidad que lo implementa, el caso de prueba que lo verifica, su estado de aceptación y la evidencia obtenida durante las pruebas.

**Regla obligatoria:** ninguna fila puede marcarse como aprobada si no tiene evidencia verificable. Si falta la evidencia, el estado debe ser `bloqueado`.

## 2. Estados de aceptación

| Estado | Descripción |
|---|---|
| Aprobado | El caso se ejecutó, cumplió el criterio de aceptación y cuenta con evidencia verificable. |
| Fallido | El caso se ejecutó y el resultado no cumplió el criterio esperado. |
| Bloqueado | No se pudo verificar el requisito, falta evidencia o existe una dependencia que impide completar la prueba. |
| Diferido | El requisito fue aplazado formalmente para una versión posterior o está excluido del alcance aprobado de esta versión. |

**Importante:** un requisito no se considera diferido solamente porque no se haya probado. Debe existir una decisión documentada que justifique su aplazamiento.

## 3. Matriz de aceptación de requisitos funcionales

Completar una fila por cada requisito funcional del ERS. Copiar el criterio de aceptación directamente del documento original, sin modificar su redacción.

| ID del requisito | Criterio de aceptación del ERS (texto literal) | Pantalla o función que lo cumple | Plan y caso de prueba | Estado | Evidencia |
|---|---|---|---|---|---|
| RF-001 | [Copiar del ERS] | [Pantalla o función] | [Plan / caso] | Bloqueado | Pendiente |
| RF-002 | [Copiar del ERS] | [Pantalla o función] | [Plan / caso] | Bloqueado | Pendiente |
| RF-003 | [Copiar del ERS] | [Pantalla o función] | [Plan / caso] | Bloqueado | Pendiente |
| RF-004 | [Copiar del ERS] | [Pantalla o función] | [Plan / caso] | Bloqueado | Pendiente |
| RF-005 | [Copiar del ERS] | [Pantalla o función] | [Plan / caso] | Bloqueado | Pendiente |
| RF-006 | [Copiar del ERS] | [Pantalla o función] | [Plan / caso] | Bloqueado | Pendiente |
| RF-007 | [Copiar del ERS] | [Pantalla o función] | [Plan / caso] | Bloqueado | Pendiente |
| RF-008 | [Copiar del ERS] | [Pantalla o función] | [Plan / caso] | Bloqueado | Pendiente |
| RF-009 | [Copiar del ERS] | [Pantalla o función] | [Plan / caso] | Bloqueado | Pendiente |
| RF-010 | [Copiar del ERS] | [Pantalla o función] | [Plan / caso] | Bloqueado | Pendiente |
| RF-011 | [Copiar del ERS] | [Pantalla o función] | [Plan / caso] | Bloqueado | Pendiente |
| RF-012 | [Copiar del ERS] | [Pantalla o función] | [Plan / caso] | Bloqueado | Pendiente |
| RF-013 | [Copiar del ERS] | [Pantalla o función] | [Plan / caso] | Bloqueado | Pendiente |
| RF-014 | [Copiar del ERS] | [Pantalla o función] | [Plan / caso] | Bloqueado | Pendiente |
| RF-015 | [Copiar del ERS] | [Pantalla o función] | [Plan / caso] | Diferido | [Decisión formal y versión objetivo] |
| RF-016 | [Copiar del ERS] | [Pantalla o función] | [Plan / caso] | Bloqueado | Pendiente |
| RF-017 | [Copiar del ERS] | [Pantalla o función] | [Plan / caso] | Bloqueado | Pendiente |
| RF-018 | [Copiar del ERS] | [Pantalla o función] | [Plan / caso] | Bloqueado | Pendiente |
| RF-019 | [Copiar del ERS] | [Pantalla o función] | [Plan / caso] | Bloqueado | Pendiente |
| RF-020 | [Copiar del ERS] | [Pantalla o función] | [Plan / caso] | Bloqueado | Pendiente |
| RF-021 | [Copiar del ERS] | [Pantalla o función] | [Plan / caso] | Bloqueado | Pendiente |
| RF-022 | [Copiar del ERS] | [Pantalla o función] | [Plan / caso] | Bloqueado | Pendiente |

**Nota sobre los identificadores:** esta tabla es una plantilla inicial para los requisitos RF-001 a RF-022. Debes contrastarla con el ERS vigente y agregar, eliminar o ajustar filas para que coincida exactamente con los requisitos reales. La condición de RF-015 como diferido debe confirmarse con el alcance aprobado de la versión.

### 3.1 Requisitos funcionales por módulo

Usar las siguientes referencias para localizar los casos de prueba. Sustituir cada referencia por el nombre y el identificador reales del caso ejecutado.

| Módulo | Pantalla o función | Plan de pruebas relacionado | Caso de prueba |
|---|---|---|---|
| Autenticación y usuarios | Inicio de sesión, gestión de usuarios y roles | [Plan correspondiente] | [ID del caso] |
| Incubadoras | Listado, detalle y administración de incubadoras | [Plan correspondiente] | [ID del caso] |
| Monitorización | Panel de mediciones y estado de dispositivos | `docs/pruebas/plan-pruebas-monitoreo-alertas.md` | [ID del caso] |
| Umbrales y alertas | Configuración de límites, reconocimiento y resolución | `docs/pruebas/plan-pruebas-monitoreo-alertas.md` | [ID del caso] |
| Históricos y estadísticas | Consulta de mediciones y estadísticas diarias | [Plan correspondiente] | [ID del caso] |
| Exportación de reportes | Generación y descarga de CSV o PDF | [Plan correspondiente] | [ID del caso] |
| Ventiladores | Envío de comandos y consulta de órdenes | [Plan correspondiente] | [ID del caso] |
| Auditoría | Consulta y filtrado de eventos | `docs/pruebas/plan-pruebas-auditoria.md` | [ID del caso] |
| Configuración | Parámetros, permisos, intervalos y purga | `docs/pruebas/plan-pruebas-configuracion.md` | [ID del caso] |

## 4. Requisitos no funcionales verificables (RNF-001 a RNF-016)

Copiar el texto de cada RNF directamente del ERS. En la columna de verificación, describir la medición o prueba realizada. No marcar un requisito como aprobado sin resultados y evidencia.

| ID | Requisito no funcional del ERS (texto literal) | Método de verificación | Resultado / observaciones | Estado | Evidencia |
|---|---|---|---|---|---|
| RNF-001 | [Copiar del ERS] | [Prueba, inspección o medición] | [Resultado real] | Bloqueado | Pendiente |
| RNF-002 | [Copiar del ERS] | [Prueba, inspección o medición] | [Resultado real] | Bloqueado | Pendiente |
| RNF-003 | [Copiar del ERS] | [Prueba, inspección o medición] | [Resultado real] | Bloqueado | Pendiente |
| RNF-004 | [Copiar del ERS] | [Prueba, inspección o medición] | [Resultado real] | Bloqueado | Pendiente |
| RNF-005 | [Copiar del ERS] | [Prueba, inspección o medición] | [Resultado real] | Bloqueado | Pendiente |
| RNF-006 | [Copiar del ERS] | [Prueba, inspección o medición] | [Resultado real] | Bloqueado | Pendiente |
| RNF-007 | [Copiar del ERS] | [Prueba, inspección o medición] | [Resultado real] | Bloqueado | Pendiente |
| RNF-008 | [Copiar del ERS] | [Prueba, inspección o medición] | [Resultado real] | Bloqueado | Pendiente |
| RNF-009 | [Copiar del ERS] | [Prueba, inspección o medición] | [Resultado real] | Bloqueado | Pendiente |
| RNF-010 | [Copiar del ERS] | [Prueba, inspección o medición] | [Resultado real] | Bloqueado | Pendiente |
| RNF-011 | [Copiar del ERS] | [Prueba, inspección o medición] | [Resultado real] | Bloqueado | Pendiente |
| RNF-012 | [Copiar del ERS] | [Prueba, inspección o medición] | [Resultado real] | Bloqueado | Pendiente |
| RNF-013 | [Copiar del ERS] | [Prueba, inspección o medición] | [Resultado real] | Bloqueado | Pendiente |
| RNF-014 | [Copiar del ERS] | [Prueba, inspección o medición] | [Resultado real] | Bloqueado | Pendiente |
| RNF-015 | [Copiar del ERS] | [Prueba, inspección o medición] | [Resultado real] | Bloqueado | Pendiente |
| RNF-016 | [Copiar del ERS] | [Prueba, inspección o medición] | [Resultado real] | Bloqueado | Pendiente |

### 4.1 Guía para verificar los RNF

La siguiente tabla ofrece ejemplos de métodos de verificación. Debe adaptarse al contenido literal de cada requisito no funcional; no presupone que todos estos atributos correspondan a los RNF del ERS.

| Atributo, si está definido en el ERS | Cómo comprobarlo | Evidencia posible |
|---|---|---|
| Rendimiento | Medir los tiempos de respuesta bajo condiciones controladas y compararlos con el umbral exigido. | Registro de tiempos y resultados de carga. |
| Seguridad | Verificar autenticación, permisos por rol y reglas de acceso al servidor. | Resultados de pruebas de permisos y reglas. |
| Usabilidad | Ejecutar tareas representativas y registrar errores de uso o dificultades. | Lista de comprobación y capturas. |
| Compatibilidad | Repetir los flujos en los navegadores y dispositivos especificados. | Matriz de navegadores y capturas. |
| Adaptabilidad visual | Probar las pantallas en los anchos definidos y revisar desbordamientos. | `docs/pruebas/plan-pruebas-responsive.md`. |
| Disponibilidad y confiabilidad | Simular interrupciones controladas y comprobar la recuperación esperada. | Registros de incidentes y recuperación. |
| Integridad de datos | Comparar datos antes y después de operaciones, cambios o purgas. | Consultas y resultados de Firestore. |
| Mantenibilidad | Revisar estructura, pruebas automatizadas, documentación y convenciones acordadas. | Informe de revisión técnica. |

Para cada RNF, seleccionar únicamente el método que corresponda a su criterio de aceptación. Si no aplica, explicar la razón y dejar constancia de quién autorizó esa decisión.

## 5. Resumen de resultados

Completar los conteos usando los resultados reales de la ejecución.

| Indicador | Cantidad |
|---|---:|
| Total de casos de prueba incluidos en el alcance evaluado | _____ |
| Casos aprobados | _____ |
| Casos fallidos | _____ |
| Casos bloqueados | _____ |
| Casos diferidos formalmente | _____ |
| Casos ejecutados (aprobados + fallidos) | _____ |

### 5.1 Cálculo del porcentaje de aprobación

El porcentaje de aprobación se calcula sobre los casos ejecutados, excluyendo los bloqueados y los diferidos:

\[
\text{Porcentaje de aprobación} =
\frac{\text{Casos aprobados}}{\text{Casos aprobados}+\text{Casos fallidos}}
\times 100
\]

Si todavía no se ha ejecutado ningún caso, registrar **N/A — sin casos ejecutados**. No mostrar 0 % como si fuera un resultado de ejecución.

**Porcentaje de aprobación obtenido:** _____ %

**Cobertura de ejecución** (casos ejecutados respecto al total incluido en el alcance):

\[
\text{Cobertura} =
\frac{\text{Casos ejecutados}}{\text{Total de casos en alcance}}
\times 100
\]

**Cobertura obtenida:** _____ %

Los requisitos funcionales y los no funcionales deben contabilizarse de forma consistente. Si un requisito tiene varios casos de prueba, registrar cada caso individual en el detalle y definir cómo se determina el estado global del requisito.

## 6. Defectos abiertos

Registrar todos los defectos que continúen sin resolución al cerrar la ronda de aceptación.

| ID del defecto | Requisito relacionado | Descripción | Gravedad | Estado | Responsable | Evidencia / seguimiento |
|---|---|---|---|---|---|---|
| DEF-001 | [ID del requisito] | [Descripción del problema] | [Crítica/Alta/Media/Baja] | Abierto | [Responsable] | [Enlace o ruta] |
| DEF-002 | [ID del requisito] | [Descripción del problema] | [Crítica/Alta/Media/Baja] | Abierto | [Responsable] | [Enlace o ruta] |

### 6.1 Clasificación de gravedad

- **Crítica:** impide el uso principal del sistema, compromete gravemente la seguridad o puede causar pérdida importante de datos.
- **Alta:** afecta una función esencial o un requisito importante sin una alternativa aceptable.
- **Media:** afecta una funcionalidad secundaria o provoca resultados incorrectos con una alternativa temporal.
- **Baja:** problema menor de presentación, texto o comportamiento que no bloquea el uso principal.

No asignar una gravedad definitiva sin analizar el impacto real del defecto.

**Total de defectos abiertos:** _____

- Críticos: _____
- Altos: _____
- Medios: _____
- Bajos: _____

## 7. Reglas para registrar evidencias

Guardar las evidencias en carpetas organizadas por módulo y caso de prueba, por ejemplo:

- `docs/pruebas/evidencias/configuracion/`
- `docs/pruebas/evidencias/auditoria/`
- `docs/pruebas/evidencias/responsive/`
- `docs/pruebas/evidencias/monitoreo-alertas/`
- `docs/pruebas/evidencias/hardware-real/`

Cada evidencia debe identificar, como mínimo:

1. El ID del requisito.
2. El ID del caso de prueba.
3. La fecha de ejecución.
4. El resultado observado.
5. El archivo, captura, registro o informe que respalda el resultado.

Una referencia como `Pendiente`, una captura no relacionada o una descripción sin respaldo no constituye evidencia suficiente para aprobar un caso.

### Regla de bloqueo por falta de evidencia

Antes de cerrar la matriz, revisar cada fila:

- Si existe evidencia suficiente y el criterio se cumple, puede marcarse **Aprobado**.
- Si existe evidencia de incumplimiento, debe marcarse **Fallido**.
- Si falta evidencia, no se pudo ejecutar la prueba o la verificación es insuficiente, debe marcarse **Bloqueado**.
- Si existe una decisión formal de aplazamiento para otra versión, puede marcarse **Diferido** y enlazar la decisión correspondiente.

Esta regla se aplica tanto a los requisitos funcionales como a los no funcionales.

## 8. Conclusión de aceptación

**Resultado general:** [Pendiente de evaluación / Aceptado / Aceptado con observaciones / No aceptado]

**Justificación:**  
[Resumir los resultados obtenidos, el porcentaje de aprobación, la cobertura de ejecución, los defectos abiertos y los riesgos pendientes.]

**Requisitos bloqueantes pendientes:**  
[Enumerar los requisitos que impiden emitir la aceptación.]

**Requisitos diferidos autorizados:**  
[Enumerar los requisitos y enlazar las decisiones de aplazamiento.]

**Responsable de la revisión:** ____________________

**Fecha de cierre:** ____________________

**Aprobación del responsable:** ____________________
