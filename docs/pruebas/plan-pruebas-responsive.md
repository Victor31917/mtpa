# Plan de pruebas responsive

## 1. Información general

- **Proyecto:** Sistema de gestión y monitorización de incubadoras.
- **Documento:** Plan de pruebas de diseño adaptable (responsive).
- **Ruta:** `docs/pruebas/plan-pruebas-responsive.md`
- **Fecha:** 20/10/2026.
- **Responsable:** Equipo de pruebas.
- **Estado:** Pendiente de ejecución.

## 2. Objetivo

Verificar que todas las pantallas del sistema puedan utilizarse correctamente en dispositivos móviles, tabletas y computadores, comprobando que la interfaz se adapte a diferentes anchos, que los elementos sean legibles y que no existan desbordamientos ni problemas de interacción.

## 3. Alcance de las pruebas

Se evaluarán las siguientes pantallas:

1. Inicio de sesión.
2. Dashboard.
3. Incubadoras: lista, detalle y formulario.
4. Alertas: lista y detalle.
5. Ventiladores.
6. Reglas de automatización.
7. Históricos.
8. Estadísticas.
9. Auditoría.
10. Configuración.
11. Usuarios.
12. Límites.

Los anchos de referencia serán:

| Dispositivo de referencia | Ancho de pantalla |
|---|---:|
| Móvil | 375 px |
| Tableta | 768 px |
| Computador | 1280 px |

Las pruebas deben ejecutarse con el viewport configurado al ancho indicado, sin confundir el ancho de la ventana del navegador con el tamaño físico del monitor.

## 4. Criterios generales de aceptación

Cada pantalla debe cumplir los siguientes criterios:

- **Sin desplazamiento horizontal de la página:** el contenido no debe provocar un desbordamiento horizontal del documento.
- **Texto legible:** títulos, etiquetas, mensajes, datos y botones deben poder leerse sin recortes.
- **Botones tocables:** los controles deben tener un área de interacción cómoda y no deben quedar superpuestos. Como referencia, procurar áreas de al menos 44 × 44 px en dispositivos táctiles.
- **Tablas utilizables:** las columnas importantes deben seguir siendo accesibles. Si una tabla necesita desplazamiento horizontal, este debe limitarse al contenedor de la tabla y no a toda la página.
- **Gráficos adaptables:** los gráficos deben ajustarse al contenedor, conservar sus etiquetas esenciales y no salirse de los límites de la pantalla.
- **Formularios funcionales:** los campos, validaciones y botones deben poder utilizarse en todos los anchos.
- **Navegación accesible:** menús, enlaces y controles no deben quedar ocultos o fuera del área visible.
- **Sin superposiciones:** banners, ventanas emergentes y mensajes no deben tapar controles esenciales.
- **Sin pérdida de funcionalidad:** adaptar el diseño no debe impedir completar las operaciones principales.

## 5. Matriz de pruebas: pantalla × tamaño

### 5.1 Matriz principal

Marcar cada celda como **Aprobado (A)**, **Fallido (F)** o **Pendiente (P)** después de ejecutar la prueba.

| Pantalla | 375 px | 768 px | 1280 px |
|---|---|---|---|
| Inicio de sesión | P | P | P |
| Dashboard | P | P | P |
| Incubadoras — lista | P | P | P |
| Incubadoras — detalle | P | P | P |
| Incubadoras — formulario | P | P | P |
| Alertas — lista | P | P | P |
| Alertas — detalle | P | P | P |
| Ventiladores | P | P | P |
| Reglas de automatización | P | P | P |
| Históricos | P | P | P |
| Estadísticas | P | P | P |
| Auditoría | P | P | P |
| Configuración | P | P | P |
| Usuarios | P | P | P |
| Límites | P | P | P |

**Total de combinaciones de pantalla y ancho: 45.**

Cada combinación debe evaluarse individualmente. No marcar como aprobada una pantalla por el simple hecho de que cargue correctamente.

### 5.2 Qué verificar en cada pantalla

| Pantalla | Comprobaciones específicas |
|---|---|
| Inicio de sesión | Campos completos, etiquetas visibles, botón de ingreso accesible y mensajes de validación legibles. |
| Dashboard | Tarjetas alineadas, indicadores visibles, navegación funcional y gráficos ajustados. |
| Incubadoras — lista | Listado legible, acciones accesibles y tabla adaptable o desplazable dentro de su contenedor. |
| Incubadoras — detalle | Datos completos, mediciones visibles, dispositivos identificables y acciones sin superposición. |
| Incubadoras — formulario | Campos adaptables, etiquetas legibles, validaciones visibles y botones accesibles. |
| Alertas — lista | Prioridad, estado, fecha y acciones visibles sin recortes. |
| Alertas — detalle | Descripción, valor, umbral, fecha y acciones legibles. |
| Ventiladores | Estado del ventilador, controles y confirmaciones visibles y utilizables. |
| Reglas de automatización | Condiciones, acciones, campos y botones accesibles sin desbordamiento. |
| Históricos | Filtros, fechas, resultados y tablas utilizables en los tres anchos. |
| Estadísticas | Gráficos, leyendas, ejes y filtros dentro del contenedor. |
| Auditoría | Fechas, eventos y detalles legibles; tabla adaptable. |
| Configuración | Formularios, opciones y botones visibles y accesibles. |
| Usuarios | Nombre, correo, rol, estado y acciones disponibles sin recortes. |
| Límites | Campos de umbrales, unidades, validaciones y acciones accesibles. |

## 6. Procedimiento de ejecución

Para cada una de las 45 combinaciones:

1. Abrir el sistema en el navegador seleccionado.
2. Configurar el ancho del viewport a 375, 768 o 1280 px.
3. Navegar hasta la pantalla que se va a probar.
4. Esperar a que termine la carga de los datos.
5. Revisar el ancho de la página y detectar posibles desbordamientos horizontales.
6. Comprobar la legibilidad de textos, etiquetas, tablas y mensajes.
7. Probar los botones, enlaces, menús, filtros y formularios disponibles.
8. Verificar que las tablas puedan consultarse y que el desplazamiento horizontal, cuando sea necesario, quede dentro de su contenedor.
9. Revisar que los gráficos se ajusten al ancho disponible.
10. Guardar una captura de pantalla cuando se detecte una falla.
11. Registrar el resultado y las observaciones en la matriz.
12. Repetir la prueba después de corregir los defectos.

## 7. Pruebas en navegadores

El equipo debe acordar los navegadores y las versiones que utilizará. Como propuesta inicial, se incluyen:

| Navegador | Versión probada | 375 px | 768 px | 1280 px |
|---|---|---|---|---|
| Google Chrome | Por registrar | P | P | P |
| Mozilla Firefox | Por registrar | P | P | P |
| Microsoft Edge | Por registrar | P | P | P |
| Safari, si está disponible | Por registrar | P | P | P |

Registrar la versión real de cada navegador. No marcar como probados los navegadores que no se hayan utilizado.

### 7.1 Recorridos principales

Repetir estos recorridos en cada navegador acordado:

**Recorrido 1: autenticación y navegación**
1. Abrir el inicio de sesión.
2. Iniciar sesión con una cuenta autorizada.
3. Acceder al dashboard.
4. Abrir la lista y el detalle de una incubadora.
5. Regresar al dashboard y comprobar que la navegación sigue funcionando.

**Recorrido 2: monitoreo y alertas**
1. Abrir el detalle de una incubadora.
2. Consultar las mediciones.
3. Abrir la lista de alertas.
4. Acceder al detalle de una alerta.
5. Comprobar la legibilidad de los datos y el funcionamiento de los controles.

**Recorrido 3: administración**
1. Abrir usuarios.
2. Consultar la lista y las acciones disponibles.
3. Abrir configuración y límites.
4. Consultar las reglas de automatización.
5. Verificar que los formularios y tablas se adapten al ancho.

**Recorrido 4: datos e informes**
1. Abrir históricos.
2. Aplicar los filtros disponibles.
3. Abrir estadísticas.
4. Verificar gráficos y leyendas.
5. Abrir auditoría y consultar sus registros.

Si una operación requiere permisos específicos, utilizar una cuenta de prueba con el rol autorizado.

## 8. Registro de fallos y capturas

Cada falla debe tener un identificador único y una captura que permita reproducir el problema.

| ID | Pantalla | Ancho | Navegador y versión | Descripción del fallo | Archivo de captura | Estado |
|---|---|---:|---|---|---|---|
| RESP-001 | Por registrar | 375 px | Por registrar | Por completar | Por completar | Pendiente |
| RESP-002 | Por registrar | 768 px | Por registrar | Por completar | Por completar | Pendiente |
| RESP-003 | Por registrar | 1280 px | Por registrar | Por completar | Por completar | Pendiente |

Las filas anteriores son ejemplos de registro, no fallos detectados. Deben sustituirse o ampliarse con los resultados reales.

### 8.1 Convención para nombrar capturas

Guardar las capturas en una carpeta del proyecto, por ejemplo:

`docs/pruebas/evidencias/responsive/`

Utilizar el siguiente formato para los archivos:

`RESP-<id>-<pantalla>-<ancho>-<navegador>.png`

Ejemplos:

- `RESP-001-dashboard-375-chrome.png`
- `RESP-002-usuarios-768-firefox.png`
- `RESP-003-estadisticas-1280-edge.png`

Cada captura debe mostrar la pantalla completa relevante y, cuando sea posible, el viewport o la herramienta de desarrollo utilizada para reproducir la falla.

### 8.2 Información obligatoria de cada incidencia

- Identificador de la incidencia.
- Fecha y hora de detección.
- Pantalla y ruta de la aplicación.
- Ancho del viewport.
- Navegador y versión.
- Pasos para reproducir.
- Resultado esperado.
- Resultado observado.
- Captura asociada.
- Prioridad o impacto.
- Responsable de corrección.
- Estado de la incidencia.
- Resultado de la repetición después de corregirla.

## 9. Clasificación de defectos

| Prioridad | Criterio |
|---|---|
| Alta | Impide acceder a una pantalla, completar una operación principal o utilizar controles esenciales. |
| Media | Recorta información importante, dificulta utilizar una tabla o afecta un gráfico de manera significativa. |
| Baja | Problema visual menor que no impide completar las operaciones. |

Si una falla afecta la lectura de una alerta, el control de un ventilador o la modificación de un límite, debe evaluarse cuidadosamente por su impacto funcional.

## 10. Criterios de aceptación finales

Las pruebas responsive se considerarán aprobadas cuando:

- [ ] Se hayan evaluado las 15 pantallas en los tres anchos establecidos.
- [ ] No exista desplazamiento horizontal no deseado en la página.
- [ ] Los textos y mensajes sean legibles.
- [ ] Los botones y controles sean accesibles.
- [ ] Las tablas puedan utilizarse sin perder el acceso a la información importante.
- [ ] Los gráficos no se desborden de sus contenedores.
- [ ] Los formularios y las acciones principales funcionen en los tres anchos.
- [ ] Se hayan repetido los recorridos acordados en los navegadores seleccionados.
- [ ] Cada falla detectada tenga una incidencia y su captura correspondiente.
- [ ] Las fallas corregidas hayan sido verificadas nuevamente.
- [ ] No queden defectos críticos o altos pendientes sin una decisión documentada.

## 11. Resumen de ejecución

- **Fecha de inicio:** Pendiente.
- **Fecha de finalización:** Pendiente.
- **Responsable de pruebas:** Pendiente.
- **Navegadores acordados:** Pendiente.
- **Combinaciones ejecutadas:** Pendiente de 45.
- **Casos aprobados:** Pendiente.
- **Casos fallidos:** Pendiente.
- **Incidencias abiertas:** Pendiente.
- **Resultado final:** Pendiente de ejecución.

## 12. Aprobación

| Rol | Responsable | Fecha | Firma o confirmación |
|---|---|---|---|
| Ejecutor de pruebas | Por completar | Por completar | Por completar |
| Responsable de desarrollo | Por completar | Por completar | Por completar |
| Revisor o instructor | Por completar | Por completar | Por completar |

**Conclusión:** este plan establece cómo validar la adaptación de la interfaz a móviles, tabletas y computadores, así como su funcionamiento en los navegadores acordados. La aprobación final depende de ejecutar las pruebas, registrar las evidencias y verificar las correcciones realizadas.

