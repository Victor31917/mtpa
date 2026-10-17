
# Protección de datos personales

- Estado: borrador para revisión y aprobación.
- Alcance: aplicación web, servicios IoT, Firebase Authentication,
  Cloud Firestore, Cloud Storage y procesos de auditoría.
- Responsable del tratamiento: [NOMBRE DE LA ORGANIZACIÓN].
- Contacto de privacidad: [CORREO OFICIAL].
- Versión: 1.0.

> Antes de publicar este documento, completar los datos del responsable,
> verificar las reglas desplegadas y aprobar los periodos de conservación.
> Este documento técnico no sustituye la revisión jurídica de la política.

## 1. Objetivo

Establecer cómo se recolectan, utilizan, consultan, actualizan,
conservan y eliminan los datos personales tratados por la aplicación.

Los datos deben utilizarse para finalidades informadas al titular,
con acceso limitado según las funciones y con medidas de seguridad
adecuadas.

## 2. Inventario de datos

Los permisos indicados a continuación son los permisos que deben
comprobarse en `firestore.rules`. No se consideran verificados hasta
compararlos con las reglas efectivamente desplegadas.

| Dato o categoría | Ubicación | Finalidad | Acceso previsto | Conservación |
|---|---|---|---|---|
| UID, correo y credenciales de autenticación | Firebase Authentication | Identificar usuarios y permitir el inicio de sesión | Servicios autorizados; el usuario accede a su cuenta según el diseño de la aplicación | Mientras la cuenta esté activa y durante el periodo adicional justificado para obligaciones aplicables |
| Perfil, rol y estado de usuario | Colección de usuarios en Firestore; nombre real de colección por verificar | Administrar cuentas, permisos y estado de acceso | Administradores autorizados; el titular según las funcionalidades implementadas | Mientras sea necesario para gestionar la cuenta; definir plazo posterior a su desactivación o eliminación |
| Mediciones de sensores | `mediciones` | Monitorear el funcionamiento de incubadoras y analizar variables ambientales | Usuarios autorizados según las reglas y roles reales | Configuración de retención histórica; mínimo de 12 meses según los requisitos del sistema |
| Estadísticas agregadas | `estadisticas_diarias` | Consultas históricas y generación de estadísticas | Usuarios autorizados según las reglas reales | Definir explícitamente; evaluar si deben conservarse durante el mismo plazo que el histórico |
| Alertas | `alertas` | Detectar incidentes, registrar su reconocimiento y resolución | Usuarios autorizados según las reglas reales | Definir y documentar el plazo de conservación |
| Umbrales | `umbrales` | Configurar los límites de operación de los sensores | Usuarios autorizados según las reglas reales | Mientras estén vigentes y durante el periodo necesario para auditoría |
| Configuración del sistema | `config_sistema` | Configurar retención, intervalo de reporte y purga | Lectura para usuarios autenticados; escritura administrativa según las reglas propuestas | Mientras esté vigente; conservar cambios de auditoría según la política aplicable |
| Eventos de auditoría | Colección usada por `registrarEvento`; verificar nombre real | Trazabilidad de cambios, administración, reportes y operaciones del sistema | Personal estrictamente autorizado | Definir un plazo documentado; no conservar indefinidamente sin justificación |
| Archivos de reportes exportados | Cloud Storage, prefijo `reportes/` | Entregar al usuario informes solicitados | Acceso mediante URL firmada temporal y permisos de servicio | Objetos temporales: configurar eliminación automática en 1–2 días, según la política aprobada |
| Respaldos de Firestore | Bucket de respaldos | Recuperación ante errores, pérdida o corrupción de datos | Cuenta de servicio y personal autorizado | 30 días según la política de respaldo propuesta |
| Exportaciones de Firebase Authentication | Bucket o almacenamiento seguro de respaldos | Recuperación de cuentas y datos exportables de autenticación | Personal autorizado | 30 días según la política de respaldo propuesta; verificar que la retención esté configurada |

### Reglas del inventario

- Las mediciones de sensores no se consideran automáticamente anónimas:
  pueden vincularse a usuarios, dispositivos, ubicaciones o actividades.
- Los UID, correos electrónicos, roles y registros de actividad pueden
  ser datos personales cuando permiten identificar a una persona.
- Los respaldos también contienen datos personales y deben recibir
  protección equivalente a la de los sistemas de origen.
- Los plazos que figuran como pendientes deben acordarse, implementarse
  y verificarse antes de considerar terminado este inventario.

## 3. Finalidades y autorización del titular

### 3.1 Finalidades

Los datos se tratan exclusivamente para las finalidades informadas,
según corresponda:

1. Crear y administrar cuentas de usuarios.
2. Autenticar a los usuarios y aplicar controles de acceso.
3. Operar las incubadoras y procesar las mediciones de sensores.
4. Detectar, reconocer y resolver alertas.
5. Generar estadísticas y reportes solicitados.
6. Mantener registros de auditoría y seguridad.
7. Realizar respaldos y recuperar el servicio ante incidentes.
8. Cumplir las obligaciones legales y contractuales que sean aplicables.

No utilizar los datos para publicidad, perfilamiento u otras finalidades
incompatibles sin evaluar previamente su legitimidad y los requisitos
de información y autorización correspondientes.

### 3.2 Creación de cuentas por un administrador

La creación administrativa de una cuenta no demuestra, por sí sola,
que el titular autorizó el tratamiento de sus datos.

Antes de recolectar o tratar datos que requieran autorización, el
responsable debe informar al titular, en lenguaje claro, sobre:

- La identidad y los datos de contacto del responsable.
- Los datos tratados y sus finalidades.
- Los derechos del titular.
- El procedimiento y canal para ejercer esos derechos.
- El carácter facultativo de las respuestas cuando corresponda
  por tratarse de datos sensibles o de menores de edad.
- La forma de consultar la política de tratamiento.

El mecanismo de autorización debe permitir acreditar quién autorizó,
cuándo lo hizo, qué información recibió y a qué tratamiento se refirió.

La organización debe conservar evidencia verificable de la autorización
cuando sea necesaria. La aceptación del aviso informativo no sustituye,
por sí sola, la autorización para el tratamiento.

### 3.3 Evidencia de autorización

**Estado actual: pendiente de verificación.**

Comprobar si el proceso `gestionarUsuario`:

- Informa al titular antes de la recolección o tratamiento.
- Obtiene y conserva la autorización cuando corresponde.
- Registra fecha, versión del aviso o política y evidencia de la decisión.
- Permite consultar la evidencia si el titular la solicita.

No marcar estos requisitos como implementados hasta que exista evidencia
técnica verificable.

## 4. Derechos del titular y procedimiento de atención

Las solicitudes deben recibirse por un canal oficial y quedar registradas
con fecha de recepción, identidad verificada, alcance, responsable,
estado y fecha de respuesta.

No solicitar contraseñas ni tokens como medio de verificación.

### 4.1 Conocer y acceder

El titular puede solicitar información sobre los datos que se tratan,
su finalidad, el uso realizado y la prueba de autorización que corresponda.

Procedimiento:

1. Recibir la solicitud por el canal oficial.
2. Verificar la identidad de la persona o la representación legal.
3. Consultar Authentication, Firestore, auditoría y demás sistemas
   pertinentes.
4. Preparar una respuesta que no exponga datos de terceros.
5. Registrar la atención y conservar evidencia de la respuesta.

La herramienta `gestionarUsuario` no sustituye una consulta integral
de los datos personales.

### 4.2 Actualizar y rectificar

Cuando los datos sean incorrectos o estén desactualizados:

1. Verificar la solicitud y los datos que deben corregirse.
2. Actualizar los campos permitidos mediante el procedimiento autorizado.
3. Comprobar que los cambios se propaguen a los sistemas pertinentes.
4. Registrar la operación sin incluir contraseñas, tokens ni otros secretos.
5. Informar al titular del resultado.

La edición administrativa de una cuenta puede ayudar a atender esta
solicitud, pero debe comprobarse que cubre todos los sistemas donde
aparecen los datos.

### 4.3 Suprimir o solicitar la revocación de la autorización

La supresión debe evaluarse teniendo en cuenta la solicitud, las
obligaciones legales o contractuales aplicables y la necesidad de
conservar registros de seguridad o auditoría.

La función `gestionarUsuario` contempla operaciones de edición,
desactivación o eliminación, según la implementación existente.

- **Desactivar:** impide o limita el acceso, pero no elimina los datos.
- **Eliminar la cuenta de Authentication:** no elimina automáticamente
  los documentos de Firestore, los reportes, las exportaciones ni
  los respaldos.
- **Eliminar documentos de Firestore:** no elimina copias ya exportadas
  ni registros mantenidos en otros sistemas.
- **Conservar auditoría:** requiere una política específica que defina
  qué campos se conservan, por cuánto tiempo y por qué motivo.

La atención de una solicitud debe abarcar todos los sistemas pertinentes.
No prometer una eliminación total si quedan copias en respaldos o si
existe una obligación válida de conservación.

Si procede la supresión, documentar las operaciones realizadas, las
excepciones justificadas y el plazo para que las copias temporales
expiren según la política de retención.

### 4.4 Plazos de respuesta

Aplicar los plazos legales vigentes que correspondan a consultas y
reclamos, con seguimiento de vencimientos y evidencia de respuesta.

Como referencia inicial para Colombia, la Ley 1581 de 2012 establece
reglas específicas para consultas y reclamos. El responsable debe
verificar los términos aplicables al caso concreto y sus modificaciones
normativas antes de aprobar el procedimiento.

## 5. Tratamiento del UID en la auditoría

El UID puede seguir siendo un dato personal cuando permite vincular
una operación con una persona.

Para mantener trazabilidad y minimizar los datos:

- No registrar contraseñas, tokens de acceso ni credenciales.
- Guardar únicamente los campos necesarios para explicar la operación.
- Restringir el acceso a los registros de auditoría.
- Establecer un plazo de conservación de la auditoría.
- Documentar las razones por las que determinados registros deben
  conservarse después de eliminar una cuenta.

Si se elimina una cuenta, no borrar automáticamente todas las referencias
de auditoría sin evaluar la necesidad de trazabilidad y las obligaciones
aplicables.

Cuando proceda, evaluar la seudonimización del UID o la eliminación de
atributos directamente identificadores, manteniendo separada y protegida
cualquier información adicional que permita volver a identificar al titular.

La conservación de auditoría no debe utilizarse como justificación
indefinida para retener cualquier dato personal.

## 6. Medidas de seguridad

### 6.1 Medidas previstas o existentes que deben verificarse

- Firebase Authentication gestiona la autenticación y las contraseñas;
  la aplicación no debe almacenarlas en documentos propios.
- Las funciones de backend comprueban roles antes de realizar operaciones
  privilegiadas.
- Las reglas de Firestore restringen la lectura y escritura por colección.
- La colección `config_sistema` restringe las modificaciones a
  administradores, según las reglas desplegadas.
- Los reportes se entregan mediante URL firmadas de corta duración.
- La configuración de Storage niega lectura y escritura directa desde
  clientes cuando así lo establecen las reglas desplegadas.
- Los procesos de respaldo tienen acceso restringido y una retención
  definida.
- Los eventos de auditoría permiten rastrear operaciones relevantes.

### 6.2 Brechas conocidas o pendientes de verificación

1. Confirmar que las reglas desplegadas coinciden con las reglas versionadas.
2. Revisar permisos de lectura de usuarios, mediciones, alertas, reportes
   y auditoría.
3. Verificar que todos los endpoints privilegiados comprueben los roles
   en el servidor.
4. Confirmar que `gestionarUsuario` no registra contraseñas ni tokens.
5. Implementar y verificar evidencia de autorización del titular.
6. Establecer los plazos pendientes del inventario y aplicarlos
   técnicamente donde corresponda.
7. Comprobar la eliminación de datos asociados a una cuenta en todos
   los servicios pertinentes.
8. Revisar la caducidad de reportes y las reglas de ciclo de vida
   del bucket.
9. Definir el acceso a respaldos, exportaciones de Auth y registros
   de auditoría.
10. Realizar pruebas periódicas de permisos y restauración.

No considerar una medida implementada solo porque aparece documentada:
debe existir configuración activa y evidencia de verificación.

## 7. Aviso de privacidad en el inicio de sesión

Decisión: **sí, agregar un aviso de privacidad visible en la pantalla
de inicio de sesión**.

El aviso debe resumir la finalidad del tratamiento y enlazar a la
política completa. No debe afirmar que el usuario otorgó autorización
por el solo hecho de iniciar sesión.

Contenido mínimo sugerido:

- Identidad del responsable del tratamiento.
- Finalidades principales.
- Derechos del titular.
- Canal de contacto para consultas y reclamos.
- Enlace a la política completa.
- Información sobre cómo obtener más detalles del tratamiento.

Los datos de contacto deben completarse antes de publicar el aviso.
La organización debe definir por separado el mecanismo de autorización
y la evidencia que conservará cuando sean requeridos.

## 8. Revisión y mantenimiento

Revisar este documento cuando cambien:

- Las colecciones o servicios que contienen datos personales.
- Los roles o las reglas de acceso.
- Los periodos de conservación.
- Las finalidades del tratamiento.
- Los procesos de creación o eliminación de cuentas.
- Los proveedores o servicios externos que reciben datos.

Mantener registro de la fecha, responsable y cambios de cada revisión.
