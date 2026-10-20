# Alcance de la versión 1.0

## 1. Información general

- **Proyecto:** Sistema de gestión y monitorización de incubadoras.
- **Versión:** 1.0
- **Documento:** Alcance funcional de la versión.
- **Fecha de elaboración:** 20 de octubre de 2026.
- **Estado:** Propuesta de alcance para revisión y aprobación.
- **Responsables:** Equipo de desarrollo e instructor evaluador.

## 2. Objetivo

Definir las funcionalidades que se incluirán en la versión 1.0 del sistema, identificar los requisitos que se aplazan y registrar las decisiones relacionadas con el soporte de idiomas y la presentación de la demostración de aceptación.

Este documento servirá como referencia para mantener alineados el código fuente, los requisitos, el diseño del sistema y la entrega académica.

## 3. Alcance funcional de la versión 1.0

La versión 1.0 incluirá los requisitos funcionales **RF-001 a RF-022, excepto RF-015**.

Los requisitos incluidos deberán estar implementados, integrados y disponibles para su validación según los criterios de aceptación definidos para el proyecto.

| Requisito | Decisión para la versión 1.0 |
|---|---|
| RF-001 a RF-014 | Incluidos en la versión 1.0, sujetos a sus criterios de aceptación. |
| RF-015 | Excluido de la versión 1.0 y diferido para una versión posterior. |
| RF-016 a RF-022 | Incluidos en la versión 1.0, sujetos a sus criterios de aceptación. |

**Nota:** El detalle del alcance de cada requisito debe verificarse en la ERS vigente. No se deben inventar nombres ni funcionalidades para los requisitos sin consultar su descripción oficial.

### 3.1 Funcionalidades que se deben validar

La demostración de la versión 1.0 debe cubrir los siguientes módulos:

1. Autenticación y gestión de usuarios.
2. Gestión de incubadoras.
3. Monitorización de sensores y mediciones.
4. Gestión de umbrales y alertas.
5. Históricos, estadísticas y exportación de reportes.
6. Control de ventiladores y automatización.
7. Auditoría y registro de eventos.
8. Configuración del sistema (MOD-08), con alcance parcial según lo acordado para la demostración.

La inclusión de estos módulos en la demostración no reemplaza la verificación individual de los requisitos RF-001 a RF-022.

## 4. Requisitos diferidos y decisiones

| Elemento | Decisión | Fecha | Justificación |
|---|---|---|---|
| RF-015 | Diferido; no forma parte de la versión 1.0. | 20/10/2026 | Se excluye expresamente del alcance de esta versión. |
| Soporte de múltiples idiomas | No se incluye como funcionalidad operativa en la versión 1.0. | 20/10/2026 | La interfaz actual está implementada en español y no existe integración funcional de traducciones. |
| Preferencia de idioma del usuario o instalación | Diferida para una versión posterior. | 20/10/2026 | Requiere definir almacenamiento de la preferencia, traducciones e integración con la interfaz. |

Las decisiones anteriores deben ser revisadas y aprobadas por el responsable del proyecto y el instructor evaluador. Si RF-015 corresponde al soporte multilingüe, se debe confirmar expresamente esta relación en la ERS antes de cerrar el alcance.

## 5. Documentación que requiere actualización

Se identifican los siguientes documentos como fuentes que deben revisarse por las posibles diferencias entre lo documentado y lo implementado.

Los archivos `.docx` serán actualizados por el equipo. Este documento Markdown funciona como referencia de la decisión de alcance y no reemplaza la edición de los documentos originales.

### 5.1 ERS (Especificación de Requisitos del Software)

- **Texto o sección que se debe revisar:** apartados de requisitos relacionados con el idioma, internacionalización, selección de idioma o preferencias de configuración.
- **Inconsistencia identificada:** si la ERS establece que el sistema permite seleccionar o cambiar el idioma, esa descripción no corresponde al funcionamiento actual.
- **Corrección requerida:** indicar que la interfaz de la versión 1.0 está disponible únicamente en español y que el soporte multilingüe queda diferido.
- **Acción:** localizar el requisito exacto y registrar su código, sección y texto original antes de modificar el documento.

### 5.2 DDS (Documento de Diseño del Sistema)

- **Texto o sección que se debe revisar:** diseño de arquitectura, configuración del sistema, almacenamiento de preferencias y componentes relacionados con idioma o internacionalización.
- **Inconsistencia identificada:** cualquier descripción de un selector de idioma, catálogo de traducciones o preferencia persistente que todavía no esté conectada al código.
- **Corrección requerida:** documentar el comportamiento real de la versión 1.0 y describir la internacionalización como una mejora futura.
- **Acción:** revisar los componentes, el modelo de datos y los diagramas que mencionen el idioma.

### 5.3 Plan de Trabajo

- **Texto o sección que se debe revisar:** actividades, entregables, hitos o tareas que incluyan traducciones, selector de idioma o soporte multilingüe.
- **Inconsistencia identificada:** actividades que aparezcan como terminadas o comprometidas para la versión 1.0 cuando no se han implementado.
- **Corrección requerida:** registrar estas actividades como diferidas, pendientes o planificadas para una versión posterior, según corresponda.
- **Acción:** actualizar el estado, responsable y fecha estimada de las tareas afectadas.

### 5.4 Registro de los textos originales

El equipo completará la siguiente tabla después de consultar los archivos `.docx` vigentes.

| Documento | Sección o página | Texto original sobre idioma | Ajuste propuesto | Responsable |
|---|---|---|---|---|
| ERS | Por verificar | Pendiente de localizar | Aclarar que la v1.0 solo ofrece español. | Equipo de requisitos |
| DDS | Por verificar | Pendiente de localizar | Documentar la implementación real y la mejora futura. | Equipo de diseño |
| Plan de Trabajo | Por verificar | Pendiente de localizar | Actualizar las tareas y su estado. | Coordinación del equipo |

**Importante:** los textos originales no se reproducen aquí porque deben extraerse de los documentos reales. No se deben presentar frases reconstruidas como si fueran citas textuales.

## 6. Estado actual del soporte de idiomas en el código

La versión actual presenta las siguientes condiciones:

1. **Interfaz en español:** los textos visibles de la interfaz están definidos en español.
2. **Sin campo `idioma`:** la colección `config_sistema` no incluye actualmente un campo funcional `idioma`.
3. **Constantes sin integración:** existen constantes relacionadas con idiomas, pero no están enlazadas a las pantallas ni controlan los textos que se muestran.
4. **Sin cambio efectivo de idioma:** la existencia de constantes no implica que el sistema traduzca la interfaz.
5. **Preferencia no persistente:** actualmente no existe un flujo funcional que permita guardar y recuperar una preferencia de idioma del usuario o de la instalación.

Por tanto, no se debe afirmar que la versión 1.0 tiene soporte multilingüe hasta que la funcionalidad esté implementada, integrada y probada.

## 7. Propuesta para una implementación futura

El soporte de múltiples idiomas se planificará para una versión posterior, una vez aprobado el alcance correspondiente.

Las actividades propuestas son:

1. **Extraer los textos fijos:** reemplazar los textos escritos directamente en los componentes por claves de traducción organizadas por módulo.
2. **Elegir una librería de internacionalización (i18n):** evaluar una solución compatible con React, que permita administrar traducciones, idioma predeterminado y cambio de idioma.
3. **Definir los idiomas iniciales:** mantener el español como idioma predeterminado y determinar con el equipo qué otros idiomas se necesitan.
4. **Definir el almacenamiento de la preferencia:** decidir si el idioma se configura por usuario o por instalación.
5. **Implementar la persistencia:** guardar y recuperar la preferencia de forma coherente con el modelo de autenticación y configuración.
6. **Integrar las pantallas:** conectar las claves de traducción con formularios, tablas, alertas, notificaciones y mensajes de error.
7. **Verificar formatos regionales:** revisar fechas, horas y números para que respeten el idioma y la configuración regional seleccionados.
8. **Realizar pruebas:** comprobar que todos los módulos se traduzcan correctamente y que la preferencia se conserve según la decisión adoptada.

### Criterios de aceptación futuros

- Todos los textos visibles deben provenir del sistema de traducciones.
- El idioma predeterminado debe ser español.
- El cambio de idioma debe actualizar las pantallas sin errores.
- La preferencia debe conservarse según el alcance definido.
- Los mensajes de validación, alertas y errores también deben traducirse.
- La implementación debe incluir pruebas y documentación actualizada.

## 8. Acuerdo para la demostración de aceptación

La propuesta de presentación contempla **7 módulos completos y el MOD-08 de configuración de forma parcial**.

Antes de la demostración, el equipo deberá confirmar esta organización con el instructor evaluador y registrar su respuesta.

### 8.1 Propuesta de presentación

| Parte | Alcance | Resultado esperado |
|---|---|---|
| Módulos 1 a 7 | Demostración completa de los flujos acordados. | Evidenciar las funcionalidades implementadas y sus criterios de aceptación. |
| MOD-08: Configuración | Demostración parcial de las funciones que realmente están disponibles. | Explicar las capacidades actuales y las limitaciones conocidas. |
| Idioma | Presentar la interfaz en español y aclarar que el cambio de idioma no está implementado. | Evitar afirmar que existe una función de internacionalización operativa. |
| Preguntas del evaluador | Explicar decisiones, requisitos diferidos y evidencias de prueba. | Confirmar que el alcance corresponde a la versión entregada. |

### 8.2 Registro de la respuesta del instructor

Completar después de consultar al instructor evaluador.

- **Fecha de consulta:** Pendiente.
- **Medio de consulta:** Pendiente.
- **Persona que realiza la consulta:** Pendiente.
- **¿Se aprueban los 7 módulos completos y el MOD-08 parcial?:** Pendiente de confirmación.
- **Observaciones del instructor:** Pendiente.
- **Ajustes solicitados:** Pendiente.
- **Responsable de registrar la respuesta:** Coordinación del equipo.

No se considerará aprobado este acuerdo hasta contar con la respuesta real del instructor. No se debe registrar una aprobación que todavía no se haya recibido.

## 9. Criterios de cierre de la versión 1.0

La versión 1.0 se considerará preparada para la entrega cuando:

- [ ] Los requisitos RF-001 a RF-022, excepto RF-015, hayan sido revisados frente a sus criterios de aceptación.
- [ ] RF-015 figure expresamente como diferido.
- [ ] Se haya revisado la ERS, el DDS y el Plan de Trabajo para corregir o señalar las descripciones desactualizadas.
- [ ] El estado real del soporte de idiomas esté documentado.
- [ ] Se haya acordado con el instructor el alcance de la demostración.
- [ ] Se hayan preparado evidencias de los módulos y un plan alternativo ante fallos.
- [ ] El equipo haya realizado y registrado los ensayos de aceptación.

## 10. Historial de decisiones

| Fecha | Decisión o cambio | Responsable | Estado |
|---|---|---|---|
| 20/10/2026 | Establecer como alcance propuesto RF-001 a RF-022, excepto RF-015. | Equipo de desarrollo | Pendiente de aprobación |
| 20/10/2026 | Documentar el estado actual del idioma y diferir su implementación multilingüe. | Equipo de desarrollo | Por validar con la ERS |
| Pendiente | Confirmar con el instructor los 7 módulos completos y MOD-08 parcial. | Coordinación del equipo | Pendiente |

---

**Conclusión:** este documento define el alcance propuesto de la versión 1.0, identifica las diferencias entre la documentación y el código y establece las tareas pendientes para la futura internacionalización. Las decisiones que requieren aprobación del instructor deberán actualizarse con su respuesta real antes de cerrar la entrega. 

