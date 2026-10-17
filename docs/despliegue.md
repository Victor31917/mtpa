
# Guía de despliegue

- Estado: plantilla pendiente de completar con los valores reales.
- Responsable del despliegue: [EQUIPO O RESPONSABLE].
- Última revisión: [AAAA-MM-DD].
- Repositorio: [URL INTERNA DEL REPOSITORIO].

## 1. Objetivo

Definir el procedimiento reproducible para desplegar el sistema IoT,
incluyendo el frontend, Cloud Functions, reglas de Firestore y Storage,
y el Servicio de Integración MQTT.

Los despliegues de staging deben realizarse y verificarse antes de
promover cambios a producción.

## 2. Ambientes

| Elemento | Desarrollo | Staging | Producción |
|---|---|---|---|
| Proyecto Firebase | `PROJECT_ID_DEV` | `PROJECT_ID_STAGING` | `PROJECT_ID_PROD` |
| Broker MQTT | `BROKER_DEV` | `BROKER_STAGING` | `BROKER_PROD` |
| Prefijo de tópicos | `dev/` | `staging/` | `prod/` |
| Servicio de Integración | Equipo local o entorno de desarrollo | Servidor/servicio de staging | Servidor/servicio de producción |
| Frontend | `URL_FRONTEND_DEV` | `URL_FRONTEND_STAGING` | `URL_FRONTEND_PROD` |
| Base de datos Firestore | Base de desarrollo | Base de staging | Base de producción |
| Bucket de respaldos | Bucket de desarrollo | Bucket de staging | Bucket de producción |
| Secretos y credenciales | Gestor de secretos de desarrollo | Gestor de secretos de staging | Gestor de secretos de producción |
| Responsable | [RESPONSABLE_DEV] | [RESPONSABLE_STAGING] | [RESPONSABLE_PROD] |

### Reglas para separar ambientes

- Cada ambiente debe utilizar su propio proyecto Firebase o una separación
  equivalente aprobada.
- Nunca conectar una instancia de desarrollo al broker de producción.
- Los prefijos MQTT deben configurarse en productores y consumidores.
- No reutilizar credenciales entre ambientes.
- No incluir claves privadas, contraseñas, tokens ni secretos en Git,
  archivos `.env` versionados o documentación.
- Guardar las credenciales en Secret Manager o en el gestor de secretos
  aprobado para el entorno de ejecución.
- Usar datos de prueba en desarrollo y staging; evitar copiar datos
  personales de producción sin una autorización y protección adecuadas.

## 3. Requisitos previos

Antes de desplegar:

- Tener acceso autorizado al proyecto Firebase de destino.
- Tener instalada una versión compatible de Node.js y npm.
- Tener instaladas las herramientas Firebase CLI y Google Cloud CLI.
- Confirmar que el broker MQTT está disponible.
- Confirmar que el Servicio de Integración tiene conectividad al broker.
- Revisar los cambios de código y las dependencias.
- Confirmar que existe un respaldo reciente de producción.
- Revisar los cambios en reglas de Firestore y Storage.
- Confirmar que las variables de entorno y los secretos corresponden
  al ambiente de destino.
- Revisar las migraciones de datos y la compatibilidad hacia atrás.

## 4. Orden de despliegue

Los comandos se ejecutan desde la raíz del repositorio, salvo que se
indique otra carpeta. Sustituir los marcadores por los valores reales.

### Paso 1. Obtener el código y revisar los cambios

```bash
git status
git pull --ff-only
```

Comprobar que se está en la rama y en el commit aprobados:

```bash
git rev-parse --short HEAD
git log -1 --oneline
```

Resultado esperado: código actualizado, cambios revisados y versión
identificable para facilitar una eventual marcha atrás.

### Paso 2. Seleccionar el proyecto Firebase

```bash
firebase login
firebase projects:list
firebase use PROJECT_ID_STAGING
firebase use
```

En producción, sustituir el ID por el proyecto de producción y verificar
dos veces el destino antes de continuar.

No ejecutar comandos de producción desde una sesión cuyo proyecto activo
no haya sido comprobado.

### Paso 3. Instalar y validar las dependencias

Si el frontend y las funciones tienen directorios independientes:

```bash
npm ci
npm --prefix functions ci
```

Para el Servicio de Integración:

```bash
npm --prefix iot-integration-service ci
```

Ejecutar las pruebas disponibles:

```bash
npm test
npm --prefix functions test
npm --prefix iot-integration-service test
```

Si alguno de estos comandos no está definido en `package.json`, documentar
el comando de pruebas real del proyecto y no considerar la validación
completada hasta ejecutar las pruebas disponibles.

### Paso 4. Validar la configuración

Comprobar que los archivos de configuración no contienen secretos y que
los valores pertenecen al ambiente elegido.

Revisar, según corresponda:

- `firebase.json`
- `firestore.rules`
- `storage.rules`
- `functions/index.js`
- `iot-integration-service/`
- Variables de entorno y referencias a secretos.
- URL del frontend y prefijos MQTT.

No imprimir el contenido de las variables secretas en logs ni en la
salida de comandos.

### Paso 5. Desplegar las reglas de Firestore

```bash
firebase deploy --only firestore:rules --project PROJECT_ID_STAGING
```

Comprobar:

- Que el despliegue terminó sin errores.
- Que usuarios autenticados pueden leer únicamente los datos permitidos.
- Que usuarios sin privilegios no pueden ejecutar escrituras administrativas.
- Que los intentos de acceso no autorizado son rechazados.

### Paso 6. Desplegar las reglas de Storage

```bash
firebase deploy --only storage --project PROJECT_ID_STAGING
```

Comprobar:

- Que las reglas se desplegaron correctamente.
- Que las lecturas y escrituras directas desde clientes están denegadas
  cuando así lo establece la política.
- Que el acceso de los servicios de confianza funciona con los permisos
  de IAM previstos.

Las reglas de Storage no sustituyen los permisos IAM del servicio.

### Paso 7. Desplegar Cloud Functions

```bash
firebase deploy --only functions --project PROJECT_ID_STAGING
```

Si se desea desplegar solo funciones específicas, utilizar la sintaxis
admitida por la versión de Firebase CLI y verificar los nombres reales
de las funciones exportadas.

Comprobar el resultado:

```bash
firebase functions:list --project PROJECT_ID_STAGING
```

Revisar los logs de las funciones modificadas y ejecutar las pruebas
funcionales correspondientes.

### Paso 8. Configurar y verificar tareas programadas

Comprobar que las tareas programadas necesarias están desplegadas,
incluyendo estadísticas diarias, auditoría y purga histórica cuando
corresponda.

Antes de habilitar una purga:

- Confirmar la configuración `config_sistema/general`.
- Verificar que `purgaActiva` tiene el valor esperado.
- Confirmar el mínimo de retención y el límite de documentos por ejecución.
- Verificar la zona horaria de la tarea.
- Comprobar los permisos de la cuenta de servicio.

No habilitar la purga en producción sin revisar previamente su alcance.

### Paso 9. Desplegar el Servicio de Integración

Utilizar el mecanismo de despliegue del entorno real: contenedor, VM,
servicio administrado o plataforma de procesos.

Ejemplo genérico si el servicio se ejecuta directamente con Node.js:

```bash
npm --prefix iot-integration-service ci
```

Después, reiniciar el servicio mediante el supervisor real de procesos.

Por ejemplo, solo si el servicio utiliza systemd:

```bash
sudo systemctl restart iot-integration-service
sudo systemctl status iot-integration-service
```

Comprobar:

- Conexión al broker MQTT correcto.
- Suscripción a los tópicos del ambiente.
- Lectura de configuración de Firestore.
- Registro del timeout efectivo y su origen.
- Ausencia de errores de autenticación y permisos.

No utilizar estos comandos de systemd si la aplicación se ejecuta en
Cloud Run, Docker Compose u otra plataforma; aplicar el procedimiento
correspondiente.

### Paso 10. Desplegar el frontend

Ejecutar la compilación desde el directorio real del frontend:

```bash
npm run build
```

Publicar el artefacto mediante la plataforma configurada para el proyecto.

Si el frontend está alojado en Firebase Hosting:

```bash
firebase deploy --only hosting --project PROJECT_ID_STAGING
```

Comprobar que la URL publicada corresponde al ambiente correcto, que
el inicio de sesión funciona y que el navegador no muestra errores
de JavaScript o solicitudes a proyectos equivocados.

### Paso 11. Verificación integral

Ejecutar el checklist de la sección 5 y registrar los resultados antes
de autorizar el despliegue en producción.

### Paso 12. Promoción a producción

Solo después de aprobar staging:

1. Confirmar el commit y la versión aprobada.
2. Confirmar el respaldo reciente de producción.
3. Verificar el proyecto activo y los secretos de producción.
4. Obtener la aprobación del responsable.
5. Desplegar siguiendo el mismo orden.
6. Ejecutar el checklist posterior.
7. Registrar el resultado y el responsable del despliegue.

## 5. Checklist de verificación posterior

Registrar cada comprobación como aprobada o fallida.

### 5.1 Plataforma

- [ ] El frontend carga desde la URL del ambiente correcto.
- [ ] El inicio de sesión funciona.
- [ ] Las reglas de Firestore están desplegadas.
- [ ] Las reglas de Storage están desplegadas.
- [ ] Las Cloud Functions esperadas están disponibles.
- [ ] El Servicio de Integración está activo.
- [ ] No aparecen errores críticos en los logs.
- [ ] Las variables de entorno y secretos corresponden al ambiente.

### 5.2 Medición IoT

- [ ] Publicar una medición de prueba en el tópico MQTT correcto.
- [ ] Confirmar que el Servicio de Integración recibe el mensaje.
- [ ] Confirmar que se guarda una medición en `mediciones`.
- [ ] Verificar dispositivo, variable, valor y marca de tiempo.
- [ ] Confirmar que no se escribió en otro ambiente.

Resultado y evidencia:
- Fecha/hora:
- Dispositivo de prueba:
- Tópico:
- Documento o identificador de medición:
- Resultado:
- Responsable:

### 5.3 Creación de alerta

- [ ] Preparar una condición de prueba que supere un umbral controlado.
- [ ] Confirmar que se genera una alerta en `alertas`.
- [ ] Verificar tipo, estado, dispositivo y fecha.
- [ ] Comprobar que no se generan alertas duplicadas inesperadamente.
- [ ] Reconocer y resolver la alerta si el flujo lo permite.

Resultado y evidencia:
- Fecha/hora:
- Identificador de alerta:
- Condición probada:
- Resultado:
- Responsable:

### 5.4 Comando de ventilador

- [ ] Confirmar que el usuario tiene el rol necesario.
- [ ] Enviar un comando de prueba mediante el flujo autorizado.
- [ ] Verificar que el comando se publica en el tópico correcto.
- [ ] Confirmar recepción y ejecución por el dispositivo o simulador.
- [ ] Verificar el estado de respuesta o confirmación.
- [ ] Confirmar que un usuario sin permisos no puede emitir el comando.

Realizar la prueba en un dispositivo seguro o simulador cuando exista
riesgo de afectar las condiciones reales de una incubadora.

Resultado y evidencia:
- Fecha/hora:
- Dispositivo:
- Tópico:
- Comando:
- Confirmación:
- Resultado:
- Responsable:

### 5.5 Exportación de reporte

- [ ] Solicitar un reporte histórico con un rango pequeño.
- [ ] Confirmar que el backend valida roles y parámetros.
- [ ] Verificar que se genera el archivo.
- [ ] Confirmar que la URL firmada permite la descarga autorizada.
- [ ] Comprobar que la URL expira según el plazo configurado.
- [ ] Verificar que el archivo contiene los datos esperados.
- [ ] Confirmar que el evento `reporte_exportado` se registra.
- [ ] Verificar que una solicitud no autorizada es rechazada.

Resultado y evidencia:
- Fecha/hora:
- Tipo y formato del reporte:
- Número de filas:
- Resultado:
- Responsable:

### 5.6 Auditoría y configuración

- [ ] Verificar que las operaciones críticas generan eventos de auditoría.
- [ ] Verificar que los cambios de configuración se registran.
- [ ] Confirmar que los eventos no contienen contraseñas ni tokens.
- [ ] Confirmar que la purga está desactivada o configurada expresamente.
- [ ] Confirmar que el timeout efectivo y su origen se registran correctamente.

## 6. Procedimiento de marcha atrás

### 6.1 Criterios de activación

Iniciar la marcha atrás cuando se presente, por ejemplo:

- Interrupción del flujo de mediciones.
- Fallos en comandos críticos.
- Pérdida de acceso legítimo por reglas incorrectas.
- Errores generalizados en inicio de sesión o generación de reportes.
- Fallos de funciones que afecten operaciones críticas.
- Riesgo de borrado no previsto o exposición de datos.

Registrar la hora, el síntoma, el alcance y la decisión del responsable.

### 6.2 Detener cambios adicionales

1. Suspender nuevos despliegues.
2. Notificar al responsable técnico.
3. Identificar el commit y los recursos afectados.
4. Conservar logs y evidencias del incidente.
5. Evitar desactivar controles de seguridad como solución temporal
   sin una aprobación explícita.

### 6.3 Marcha atrás de Cloud Functions

Firebase CLI permite desplegar código anterior si se dispone del commit
aprobado.

```bash
git checkout COMMIT_ESTABLE
npm --prefix functions ci
firebase deploy --only functions --project PROJECT_ID_STAGING
```

Antes de ejecutar estos comandos, confirmar que el commit anterior es
compatible con la base de datos y la configuración actuales.

En producción, aplicar el procedimiento de aprobación y utilizar
`PROJECT_ID_PROD` solo cuando se haya autorizado expresamente.

Si el problema afecta una sola función, evaluar un despliegue limitado
a esa función en lugar de revertir todo el conjunto.

### 6.4 Marcha atrás de reglas de Firestore

Restaurar el archivo de reglas de la versión estable y desplegarlo:

```bash
git checkout COMMIT_ESTABLE -- firestore.rules
firebase deploy --only firestore:rules --project PROJECT_ID_STAGING
```

Revisar los permisos después del despliegue y confirmar que no se
han abierto accesos adicionales.

No restaurar reglas más permisivas sin revisar su impacto.

### 6.5 Marcha atrás de reglas de Storage

Restaurar las reglas versionadas de la versión estable y desplegarlas:

```bash
git checkout COMMIT_ESTABLE -- storage.rules
firebase deploy --only storage --project PROJECT_ID_STAGING
```

Comprobar lectura y escritura desde clientes y acceso de los servicios
de confianza después de la reversión.

### 6.6 Frontend y Servicio de Integración

- Frontend: volver a publicar el artefacto estable aprobado.
- Servicio de Integración: volver a la versión estable mediante el
  procedimiento de despliegue del entorno.
- Verificar que el broker, los tópicos y las credenciales corresponden
  al ambiente.
- Repetir las pruebas de medición, alerta y comando de ventilador.

### 6.7 Si el problema afecta los datos

Revertir código o reglas no revierte los datos modificados.

Si se requiere recuperar datos:

1. Detener las operaciones que puedan ampliar el daño, cuando sea seguro.
2. Obtener aprobación del responsable.
3. Elegir un respaldo verificado.
4. Restaurar primero en una base nueva.
5. Validar la integridad y decidir el procedimiento de recuperación.
6. No restaurar sobre producción sin aprobación explícita y plan de
   recuperación y reversión.

## 7. Registro del despliegue

Completar una entrada por despliegue.

| Campo | Valor |
|---|---|
| Fecha y hora | |
| Ambiente | |
| Proyecto Firebase | |
| Commit o versión | |
| Responsable | |
| Aprobador | |
| Funciones desplegadas | |
| Reglas desplegadas | |
| Versión del frontend | |
| Versión del Servicio de Integración | |
| Respaldo verificado | |
| Checklist completado | |
| Resultado | |
| Incidencias | |
| ¿Se hizo marcha atrás? | |

## 8. Cierre

El despliegue se considera exitoso cuando:

- Todos los componentes esperados están activos.
- Las pruebas funcionales críticas han sido aprobadas.
- Los permisos funcionan como se espera.
- No existen errores críticos sin resolver.
- Se ha registrado la versión desplegada y el responsable.
