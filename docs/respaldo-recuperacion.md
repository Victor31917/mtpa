
# Política de respaldo y recuperación

## 1. Objetivo y alcance

Este procedimiento define cómo respaldar y recuperar los datos de
Firestore y los usuarios de Firebase Authentication.

La política mínima para producción es:

- Frecuencia: diaria.
- Retención: 30 días.
- Destino: bucket privado de Google Cloud Storage.
- Restauración: siempre a una base de datos nueva durante las pruebas.
- RTO: medir y registrar el tiempo real de recuperación.
- RPO: hasta 24 horas de cambios pueden perderse si el último respaldo
  disponible tiene un día de antigüedad.

Aplicar esta política a producción como mínimo. Los proyectos de
pruebas y desarrollo pueden utilizar una política diferente, documentada
por separado.

## 2. Variables del entorno

Sustituir los siguientes valores por los datos reales del proyecto:

| Variable | Descripción |
|---|---|
| `PROJECT_ID` | ID del proyecto de Google Cloud/Firebase |
| `BUCKET_RESPALDOS` | Bucket dedicado para respaldos |
| `DATABASE_ID` | Base de datos de origen, normalmente `(default)` |
| `DATABASE_NUEVA` | ID exclusivo para la restauración de prueba |
| `LOCATION` | Ubicación compatible con Firestore |
| `SA_BACKUP` | Cuenta de servicio del proceso de respaldo |
| `RESPONSABLE_BACKUP` | Responsable operativo de los respaldos |
| `RESPONSABLE_RESTAURACION` | Responsable autorizado para restaurar |

No almacenar credenciales, claves privadas ni tokens en este documento.

## 3. Cronograma de respaldos

### Frecuencia

Ejecutar una exportación completa de Firestore todos los días a las
02:00, usando la zona horaria UTC. El proceso debe finalizar con un
estado verificable de éxito o error.

| Tarea | Frecuencia | Hora UTC | Retención |
|---|---|---|---|
| Exportación de Firestore | Diaria | 02:00 | 30 días |
| Exportación de usuarios de Firebase Auth | Diaria | 02:30 | 30 días |
| Verificación del respaldo | Diaria, después de exportar | Después de cada tarea | Según la política de registros |
| Prueba de restauración | Trimestral y después de cambios importantes | Programada | Registrar resultados |

### Configuración del cron

En un ejecutor seguro que tenga `gcloud`, Firebase CLI y los permisos
necesarios, configurar el siguiente cron:

```cron
0 2 * * * /opt/mi-proyecto/scripts/backup-firestore.sh >> /var/log/backup-firestore.log 2>&1
30 2 * * * /opt/mi-proyecto/scripts/backup-auth.sh >> /var/log/backup-auth.log 2>&1
```

Estos comandos son una plantilla para un ejecutor Linux. La programación
no queda activa hasta instalar las tareas en el entorno autorizado.

Registrar aquí la configuración real después de instalarla:

- Proyecto:
- Zona horaria:
- Ejecutor:
- Fecha de instalación:
- Responsable:
- Comando o configuración efectivamente aplicada:

## 4. Exportación de Firestore

La exportación se ejecuta desde un entorno de confianza con `gcloud`
autenticado mediante una cuenta de servicio autorizada.

Ejemplo de comando manual:

```bash
gcloud firestore export \
  "gs://BUCKET_RESPALDOS/firestore/$(date -u +%Y%m%dT%H%M%SZ)" \
  --project="PROJECT_ID" \
  --database="(default)"
```

Sustituir `BUCKET_RESPALDOS` y `PROJECT_ID` por los valores reales.
Para otra base de datos, sustituir `(default)` por su ID.

El proceso automatizado debe:

1. Generar un identificador único para la exportación.
2. Comprobar que la operación terminó correctamente.
3. Registrar fecha, proyecto, base de datos, destino y resultado.
4. Alertar al responsable si falla.
5. No considerar un respaldo válido hasta confirmar que la exportación
   terminó correctamente.

### Permisos

La cuenta de servicio debe disponer únicamente de los permisos necesarios
para exportar Firestore y escribir en el bucket de respaldos.

El responsable de infraestructura administra estos permisos. No se
deben conceder permisos amplios de propietario del proyecto solo para
ejecutar respaldos.

## 5. Retención de 30 días

Usar un bucket dedicado para respaldos y configurar una regla de ciclo
de vida que elimine los objetos después de 30 días.

Ejemplo de archivo `lifecycle.json`:

```json
{
  "rule": [
    {
      "action": {
        "type": "Delete"
      },
      "condition": {
        "age": 30
      }
    }
  ]
}
```

Aplicar la política al bucket:

```bash
gcloud storage buckets update gs://BUCKET_RESPALDOS \
  --lifecycle-file=lifecycle.json
```

**Precaución:** esta política afecta a todos los objetos del bucket.
Utilizar un bucket exclusivo para respaldos o definir una política
de retención que proteja los demás datos.

La eliminación por ciclo de vida no necesariamente ocurre exactamente
al cumplirse los 30 días. Verificar también si hay retenciones,
versionado o políticas de conservación que impidan borrar objetos.

## 6. Cómo consultar los respaldos disponibles

Listar los respaldos de Firestore:

```bash
gcloud storage ls \
  gs://BUCKET_RESPALDOS/firestore/
```

Consultar el contenido de un respaldo específico:

```bash
gcloud storage ls -r \
  gs://BUCKET_RESPALDOS/firestore/IDENTIFICADOR_RESPALDO/
```

Antes de restaurar, verificar:

- Que el respaldo corresponde al proyecto y base de datos esperados.
- Que la operación de exportación finalizó correctamente.
- Que los archivos de metadatos de la exportación están presentes.
- Que la cuenta ejecutora tiene permiso para leer el respaldo.
- Que se ha elegido explícitamente una base de datos de destino nueva.

## 7. Restauración de prueba a una base nueva

Nunca restaurar sobre la base de producción como parte de una prueba.

### 7.1 Crear la base de datos de destino

Elegir un ID que no exista y una ubicación compatible con la
configuración del proyecto.

```bash
gcloud firestore databases create \
  --project="PROJECT_ID" \
  --database="DATABASE_NUEVA" \
  --location="LOCATION" \
  --type="firestore-native"
```

Antes de ejecutar el comando, confirmar que `DATABASE_NUEVA` no
corresponde a producción ni contiene datos que deban conservarse.

### 7.2 Importar el respaldo

```bash
gcloud firestore import \
  "gs://BUCKET_RESPALDOS/firestore/IDENTIFICADOR_RESPALDO" \
  --project="PROJECT_ID" \
  --database="DATABASE_NUEVA"
```

La cuenta que realiza la importación debe tener los permisos adecuados
sobre la base de datos de destino y acceso de lectura al respaldo.

La restauración puede tardar varios minutos o más, según el tamaño
de los datos. Esperar a que la operación termine y verificar su estado.

### 7.3 Validar los datos restaurados

Comprobar como mínimo:

- Que existen las colecciones esperadas.
- Que los documentos de muestra coinciden con los del respaldo.
- Que las cantidades aproximadas de documentos son razonables.
- Que los campos de fecha, identificadores y referencias se conservan.
- Que la aplicación puede leer los datos de la base restaurada sin
  conectarse accidentalmente a producción.

No habilitar procesos de escritura, tareas programadas ni integraciones
IoT de producción contra la base restaurada.

## 8. Exportación de usuarios de Firebase Authentication

La exportación de usuarios es independiente del respaldo de Firestore.
Debe realizarse diariamente para reducir la pérdida potencial de cambios
en cuentas, perfiles de autenticación y atributos exportables.

Ejemplo con Firebase CLI:

```bash
firebase auth:export \
  "/ruta-segura/auth-$(date -u +%Y%m%dT%H%M%SZ).json" \
  --project="PROJECT_ID" \
  --format=json
```

La ruta debe apuntar a un almacenamiento seguro, no a una carpeta
pública ni a un repositorio Git.

Después de exportar:

1. Verificar que el comando terminó correctamente.
2. Guardar la exportación en el repositorio seguro de respaldos.
3. Restringir el acceso a personal autorizado.
4. Aplicar la retención definida y cifrar los archivos cuando corresponda.
5. Registrar la fecha y el resultado de la exportación.

Las exportaciones de Authentication pueden contener información
personal y, según las opciones utilizadas, hashes de contraseñas.
No deben publicarse ni tratarse como archivos ordinarios.

### Cuándo exportar usuarios

- Diariamente, después de las operaciones relevantes del día.
- Antes de migraciones o cambios importantes en Authentication.
- Antes de modificaciones masivas de cuentas.
- Antes de procedimientos de recuperación que puedan afectar usuarios.

La exportación de usuarios no sustituye la recuperación de otros
elementos de Firebase Authentication, como la configuración del proveedor,
las plantillas de correo, los ajustes del proyecto o todas las
configuraciones de autenticación.

## 9. Permisos para consultar y restaurar

Definir formalmente los responsables antes de activar el procedimiento.

| Operación | Responsable autorizado |
|---|---|
| Consultar registros de respaldo | Operador de infraestructura autorizado |
| Ejecutar exportaciones | Cuenta de servicio de respaldo |
| Restaurar a una base nueva | Administrador de infraestructura autorizado |
| Aprobar una recuperación de producción | Responsable técnico y responsable del servicio |
| Gestionar exportaciones de Authentication | Administrador autorizado de Firebase Auth |

La cuenta de servicio automatizada no debe tener permisos de restauración
sobre producción si no son necesarios para sus tareas habituales.

Toda recuperación de producción requiere aprobación explícita, revisión
del destino y un plan de reversión.

## 10. Prueba de restauración y RTO medido

Realizar una restauración a una base nueva antes de declarar operativo
el procedimiento.

Registrar los siguientes datos:

- Fecha y hora de inicio:
- Fecha y hora de finalización:
- Proyecto de origen:
- Base de datos de destino:
- Identificador del respaldo:
- Tamaño del respaldo, si está disponible:
- Duración de exportación:
- Duración de importación:
- Tiempo de validación:
- Resultado de las verificaciones:
- Incidencias:
- Responsable de la prueba:

**RTO medido** = hora de finalización de la recuperación validada
menos hora de inicio del procedimiento de recuperación.

No rellenar el RTO con una estimación. Anotar la duración observada
en una prueba real.

### Evidencias

Conservar de forma segura:

- Registro de la operación de exportación.
- Registro de la importación.
- Resultados de las comprobaciones de datos.
- Fecha, duración y responsable.
- Incidencias y acciones correctivas.

## 11. Limitaciones y pérdida potencial de datos

Con respaldos diarios puede perderse lo que se haya cambiado después
del último respaldo disponible.

La pérdida potencial puede alcanzar hasta 24 horas, suponiendo que el
respaldo diario se complete correctamente y esté disponible.

La retención de 30 días no garantiza por sí sola la recuperación de
datos borrados o alterados si el problema no se detecta dentro de ese
periodo.

Los datos de Firebase Authentication requieren su propia exportación
y procedimiento de recuperación.

## 12. Registro operativo de respaldos

Mantener un registro por cada ejecución:

| Fecha UTC | Proyecto | Tipo | Resultado | Identificador | Responsable |
|---|---|---|---|---|---|
| Pendiente | Producción | Firestore | Pendiente de ejecución | Pendiente | Pendiente |
| Pendiente | Producción | Authentication | Pendiente de ejecución | Pendiente | Pendiente |

Actualizar esta tabla con resultados reales. No registrar un respaldo
como satisfactorio hasta verificar que la operación terminó correctamente.
```

## 2. Comprobaciones necesarias antes de darlo por terminado

Hay tres cosas que debes hacer en el entorno real para que el procedimiento no se quede solo en documentación:

1. **Programar y verificar los comandos:** el cron de ejemplo no queda instalado por crear el archivo. Configura el ejecutor seguro, prueba ambos scripts y registra los comandos efectivamente utilizados.
2. **Aplicar la retención:** ejecuta la actualización del bucket y comprueba que la política de ciclo de vida quedó aplicada.
3. **Realizar la restauración de prueba:** crea la base nueva, importa un respaldo, valida los datos y anota el RTO medido.

Un detalle importante: la importación debe realizarse en una base de datos nueva compatible con el formato de exportación. Confirma que tu versión de `gcloud` admite el parámetro `--database` en ambos comandos y que la ubicación de destino es válida antes de ejecutar la recuperación.

Puedes continuar con <FollowUp value="Crear los scripts de respaldo" query="Ayúdame a crear scripts bash reales para exportar Firestore y Firebase Authentication, verificar el resultado y guardar los respaldos en Cloud Storage con seguridad."/> o <FollowUp value="Preparar una prueba de restauración" query="Ayúdame a preparar un procedimiento de restauración de prueba con comandos verificables y una plantilla para medir el RTO sin tocar producción."/>.