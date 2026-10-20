# Plan de pruebas de exportación de reportes

## 1. Objetivo

Verificar que las exportaciones de históricos y estadísticas en CSV y PDF sean correctas, legibles, coherentes con la información mostrada en pantalla y seguras frente a accesos no autorizados.

También se validarán la caducidad de los enlaces de descarga, los límites de consulta, los permisos por rol y el registro de auditoría.

## 2. Preparación

- Disponer de datos de prueba de una incubadora con variables y mediciones conocidas.
- Tener disponibles los servicios de exportación CSV y PDF.
- Contar con un bucket privado para almacenar temporalmente los archivos, si la aplicación utiliza almacenamiento de objetos.
- Disponer de usuarios de prueba para los tres roles autorizados del sistema.
- Tener acceso a los registros de auditoría.
- Configurar el límite máximo de registros exportables y la caducidad del enlace en 15 minutos.
- Verificar que la pantalla de históricos y estadísticas permita consultar el mismo periodo que se exportará.

## 3. Casos de prueba funcionales

| ID | Caso | Procedimiento | Resultado esperado |
|---|---|---|---|
| EXP-01 | CSV de histórico con acentos y comas | Exportar datos que contengan textos como `Temperatura, cámara` y `Humedad: revisión ágil`. Abrir el archivo en Excel. | Los caracteres acentuados se conservan y las comas dentro de los campos no desplazan las columnas. |
| EXP-02 | CSV de estadísticas | Exportar estadísticas que incluyan encabezados y textos con acentos, comas y caracteres especiales. Abrir en Excel. | El archivo conserva la codificación, los encabezados y la separación correcta de columnas. |
| EXP-03 | PDF legible | Exportar un reporte de una incubadora, una variable y un periodo definidos. | El PDF muestra correctamente el encabezado de la incubadora, la variable, el periodo y los datos. No hay textos cortados ni superpuestos. |
| EXP-04 | Coincidencia con pantalla | Comparar los registros y estadísticas de la interfaz con los del archivo exportado, aplicando los mismos filtros. | Los datos, el periodo, los filtros y los valores coinciden. Se documentan las diferencias intencionales de formato. |
| EXP-05 | Rango sin datos | Exportar un periodo que no contenga mediciones. | La aplicación genera un archivo válido que informa claramente «Sin datos», sin incluir registros ajenos al periodo. |
| EXP-06 | Rango que supera el límite | Solicitar un periodo cuyo número de registros exceda el máximo permitido. | La solicitud se rechaza con un mensaje claro que informa que el rango supera el límite y cómo corregirlo. No se genera un reporte parcial engañoso. |

## 4. Casos de seguridad y permisos

| ID | Caso | Procedimiento | Resultado esperado |
|---|---|---|---|
| EXP-07 | Caducidad del enlace | Generar una exportación, descargarla antes de los 15 minutos y volver a intentar la descarga cuando haya expirado. | La URL deja de permitir el acceso a los 15 minutos. El servidor responde con un rechazo de autorización, por ejemplo HTTP 403 o 401, según la implementación. |
| EXP-08 | Usuario sin sesión | Solicitar directamente el endpoint de exportación sin una sesión válida. | El servidor rechaza la solicitud, normalmente con HTTP 401, y no entrega información ni genera una exportación accesible. |
| EXP-09 | Bucket privado | Intentar acceder al objeto mediante su URL directa sin credenciales autorizadas. | El acceso directo se deniega. Los permisos del bucket no permiten lectura pública desde el cliente. |
| EXP-10 | Exportación con los tres roles | Iniciar sesión con cada uno de los tres roles y probar históricos, estadísticas y formatos permitidos. | Cada rol puede exportar únicamente los reportes autorizados por la política de permisos del sistema. |
| EXP-11 | Auditoría de exportación | Realizar una exportación exitosa y consultar los registros de auditoría. | Se crea un evento `reporte_exportado` por exportación, con usuario, fecha, tipo de reporte y resultado, según el esquema de auditoría definido. |

## 5. Validaciones técnicas

### CSV

- Usar codificación UTF-8; considerar BOM UTF-8 si se requiere compatibilidad con Excel.
- Escapar correctamente comillas dobles, separadores y saltos de línea dentro de los campos.
- Verificar que los encabezados y las filas tengan el mismo número de columnas.
- Comprobar que los valores numéricos no cambien durante la serialización.

### PDF

- Validar el encabezado de la incubadora, la variable y el periodo solicitado.
- Comprobar que el documento pueda abrirse con un lector PDF.
- Verificar que los textos y las tablas sean legibles y no queden recortados.
- Comprobar que el contenido corresponda a los filtros seleccionados.

### Seguridad

- La autenticación y la autorización deben validarse en el servidor.
- El bucket debe ser privado y no debe exponer credenciales en el cliente.
- Los enlaces temporales deben tener una expiración real y verificable.
- Los usuarios no deben poder descargar reportes de incubadoras a las que no tienen acceso.
- Las URL caducadas no deben poder reutilizarse para acceder al archivo.

### Auditoría

El evento `reporte_exportado` debe incluir, cuando corresponda:

- Identificador del usuario.
- Fecha y hora.
- Tipo de reporte: histórico o estadísticas.
- Formato: CSV o PDF.
- Incubadora y periodo exportados.
- Resultado de la operación.
- Identificador de la solicitud, si existe.

No registrar tokens, credenciales ni URL firmadas completas.

## 6. Criterios de aceptación

- [ ] Los CSV de histórico y estadísticas se abren correctamente en Excel.
- [ ] Los acentos, las comas y los caracteres especiales se conservan.
- [ ] El PDF es legible y contiene la incubadora, la variable y el periodo.
- [ ] Los archivos coinciden con la información mostrada en pantalla.
- [ ] Los rangos sin datos producen un archivo válido con «Sin datos».
- [ ] Los rangos que superan el límite son rechazados con un mensaje claro.
- [ ] Los enlaces de descarga caducan a los 15 minutos.
- [ ] Las solicitudes sin sesión son rechazadas.
- [ ] El bucket no permite lectura pública.
- [ ] Los tres roles respetan las reglas de autorización.
- [ ] Cada exportación exitosa genera el evento `reporte_exportado`.
- [ ] Los registros de auditoría no exponen secretos.

## 7. Registro de ejecución

| Campo | Resultado |
|---|---|
| Fecha de ejecución | Pendiente |
| Responsable | Pendiente |
| Pruebas aprobadas | Pendiente |
| Pruebas fallidas | Pendiente |
| Incidencias | Pendiente |
| Resultado final | Pendiente |

## 8. Conclusión

La funcionalidad se considera validada cuando todos los casos aplicables pasan, los archivos son correctos, las restricciones de acceso funcionan en el servidor y las exportaciones quedan registradas en auditoría.
