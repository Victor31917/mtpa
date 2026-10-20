# Plan de pruebas de seguridad y autorización

## 1. Objetivo

Verificar que cada operación esté autorizada de forma consistente en:

1. La pantalla y los componentes de la interfaz.
2. Las Cloud Functions y los endpoints del servidor.
3. Las reglas de seguridad de Firestore y Storage, y las ACL del broker MQTT cuando corresponda.

También se comprobarán usuarios desactivados, tokens con roles obsoletos, aislamiento entre incubadoras, privacidad de reportes y mensajes de error.

## 2. Roles de prueba

- **Administrador:** gestiona usuarios, recursos, permisos y configuración.
- **Operador:** opera las incubadoras autorizadas y atiende alertas según los permisos asignados.
- **Consulta:** puede visualizar los datos autorizados, sin modificarlos.
- **Sin sesión:** no dispone de una identidad autenticada válida.

La asignación de permisos debe ajustarse a la política real del sistema. Un permiso de lectura no debe permitir modificaciones ni acceso a datos de otra incubadora.

## 3. Convenciones de la matriz

En las matrices siguientes:

- **P:** permitido, si el recurso está dentro del ámbito autorizado.
- **D:** denegado.
- **C:** condicionado a un permiso específico que debe documentarse y probarse.
- **N/A:** no aplica directamente a esa capa; no significa que se omitan los controles de seguridad.

### Política de referencia por operación

| Operación | Administrador | Operador | Consulta | Sin sesión |
|---|---|---|---|---|
| Usuarios: listar y consultar | P | D | D | D |
| Usuarios: crear, editar y desactivar | P | D | D | D |
| Incubadoras: consultar | P | P | P | D |
| Incubadoras: crear, editar y eliminar | P | C | D | D |
| Dispositivos: consultar | P | P | P | D |
| Dispositivos: registrar o modificar | P | C | D | D |
| Umbrales: consultar | P | P | P | D |
| Umbrales: modificar | P | C | D | D |
| Alertas: consultar | P | P | P | D |
| Alertas: reconocer | P | P | D | D |
| Alertas: resolver | P | C | D | D |
| Ventiladores: enviar comando | P | P | D | D |
| Ventiladores: cambiar modo | P | C | D | D |
| Ventiladores: gestionar reglas | P | C | D | D |
| Históricos: consultar | P | P | P | D |
| Estadísticas: consultar | P | P | P | D |
| Exportación de reportes | P | P | P | D |
| Auditoría: consultar | P | D | D | D |
| Configuración: consultar | P | C | D | D |
| Configuración: modificar | P | D | D | D |

**Nota:** los permisos condicionados (C) deben convertirse en una decisión explícita para cada operación. No se debe interpretar un permiso indefinido como autorización.

## 4. Matriz de comprobación por capas

Para cada combinación de rol y operación se debe registrar la respuesta de las tres capas. Los resultados esperados son los siguientes:

| Capa | Operación permitida | Operación denegada |
|---|---|---|
| Pantalla | Muestra la función y los datos autorizados. | Oculta o deshabilita la acción y no presenta datos restringidos. |
| Cloud Function | Autoriza la identidad, el rol vigente, la operación y el ámbito del recurso. | Rechaza la solicitud aunque se invoque directamente, sin confiar en la interfaz. |
| Firestore | Permite solo las lecturas y escrituras expresamente autorizadas. | Rechaza accesos directos no autorizados. |
| Storage | Entrega únicamente archivos accesibles para esa identidad. | Impide descargar reportes ajenos o mediante URL no autorizadas. |
| Broker MQTT | Acepta publicaciones solo en tópicos asignados al dispositivo. | Rechaza publicaciones en tópicos de otra incubadora. |

Las reglas de Firestore no protegen automáticamente las operaciones ejecutadas con el SDK Admin dentro de una Cloud Function. Esas funciones deben realizar su propia autorización en el servidor.

## 5. Registro por cada celda de la matriz

Para cada operación de la sección 3, ejecutar una prueba por rol y completar una fila por capa.

| ID | Operación | Rol | Capa | Esperado | Resultado real | Estado | Evidencia |
|---|---|---|---|---|---|---|---|
| SEG-001 | Usuarios: listar | Administrador | Pantalla | P | Pendiente | Pendiente | Pendiente |
| SEG-002 | Usuarios: listar | Administrador | Cloud Function | P | Pendiente | Pendiente | Pendiente |
| SEG-003 | Usuarios: listar | Administrador | Firestore | P según reglas | Pendiente | Pendiente | Pendiente |
| SEG-004 | Usuarios: listar | Operador | Pantalla | D | Pendiente | Pendiente | Pendiente |
| SEG-005 | Usuarios: listar | Operador | Cloud Function | D | Pendiente | Pendiente | Pendiente |
| SEG-006 | Usuarios: listar | Operador | Firestore | D | Pendiente | Pendiente | Pendiente |

Repetir el formato para todas las operaciones y roles. No marcar una prueba como aprobada sin evidencia verificable. Si una operación no utiliza una capa, registrar N/A y explicar el motivo.

## 6. Pruebas adicionales obligatorias

### SEG-ROLE-01: usuario desactivado

1. Iniciar sesión con un usuario activo.
2. Desactivar la cuenta mediante el mecanismo administrativo.
3. Intentar acceder con la sesión anterior y con una sesión nueva.
4. Invocar directamente una Cloud Function protegida.

**Esperado:** se deniega el acceso protegido. La autorización no debe depender únicamente de que la interfaz o el proveedor de identidad mantengan una sesión abierta.

### SEG-ROLE-02: token con rol antiguo

1. Iniciar sesión con un usuario de rol operador.
2. Obtener el token de autenticación.
3. Cambiar el rol del usuario a consulta.
4. Repetir una operación exclusiva del operador con el token anterior.
5. Repetir la prueba después de renovar el token.

**Esperado:** el cambio de rol se aplica conforme a la política de revocación definida. Un token con claims antiguos no debe permitir mantener privilegios superiores durante un periodo no autorizado.

La Cloud Function debe comprobar la fuente de autorización vigente cuando corresponda. Renovar el token no sustituye por sí solo la validación de permisos.

### SEG-MQTT-01: aislamiento de tópicos

1. Registrar un dispositivo asociado a la incubadora A.
2. Intentar publicar en un tópico autorizado de A.
3. Intentar publicar en un tópico equivalente de la incubadora B.
4. Repetir con credenciales de dispositivo inválidas o revocadas.

**Esperado:** la ACL del broker permite la publicación autorizada y rechaza la publicación cruzada. No se debe confiar únicamente en un identificador de incubadora enviado en el payload.

### SEG-STORAGE-01: reportes privados

1. El usuario A genera un reporte.
2. El usuario B intenta descargarlo usando el identificador del objeto.
3. Repetir la prueba con la URL de descarga obtenida por A.
4. Verificar el acceso después de expirar la URL temporal.

**Esperado:** B no puede acceder al reporte de A sin autorización explícita. Los objetos no son públicos y las URL temporales caducan según la política definida.

### SEG-ERROR-01: mensajes de error

1. Provocar errores controlados de autorización, validación y recurso inexistente.
2. Inspeccionar las respuestas visibles en la interfaz y en la API.
3. Revisar que no se incluyan trazas internas, rutas del servidor, credenciales, tokens, consultas, secretos o datos personales ajenos.

**Esperado:** el usuario recibe un mensaje claro y seguro; los detalles técnicos se registran en logs protegidos con un identificador de correlación.

## 7. Criterios de aceptación

- [ ] Todas las combinaciones rol-operación tienen un resultado esperado definido.
- [ ] La interfaz no expone acciones no permitidas.
- [ ] Las Cloud Functions validan autorización en el servidor.
- [ ] Las reglas de Firestore impiden accesos directos no autorizados.
- [ ] Los usuarios desactivados no pueden ejecutar operaciones protegidas.
- [ ] Los cambios de rol no permiten conservar privilegios antiguos indebidamente.
- [ ] Las ACL MQTT aíslan las incubadoras.
- [ ] Los reportes de Storage respetan los permisos de acceso.
- [ ] Los errores no revelan información interna.
- [ ] Cada prueba tiene resultado real, estado y evidencia.

## 8. Resultado final

| Campo | Resultado |
|---|---|
| Fecha de ejecución | Pendiente |
| Responsable | Pendiente |
| Total de pruebas | Pendiente |
| Aprobadas | Pendiente |
| Fallidas | Pendiente |
| Bloqueadas | Pendiente |
| Incidencias críticas | Pendiente |
| Resultado final | Pendiente |

No se considera aprobada una capa por el mero hecho de que otra capa haya bloqueado la operación. Cada control debe probarse de forma independiente.
