# Notificaciones de alertas por correo — M.T.P.A.

Cuando se crea una alerta en `alertas/{alertaId}` (la genera
`procesarMedicion` al detectar una medición fuera de umbral), la Cloud
Function `notificarAlerta` (`functions/index.js`) prepara un correo para cada
administrador activo (`usuarios` con `rol == "administrador"` y
`activo == true`).

## Cómo funciona

`notificarAlerta` **no envía correos directamente**. Escribe un documento por
destinatario en la colección `mail` de Firestore, y es la extensión de
Firebase **Trigger Email** la que lee esa colección y realiza el envío
(SMTP).

Cada documento tiene esta forma:

| Campo             | Descripción                                                           |
| ----------------- | ----------------------------------------------------------------------- |
| `to`              | Correo del administrador (campo `correo` de `usuarios`).                 |
| `message.subject` | Campo `titulo` de la alerta.                                            |
| `message.text`    | Campo `mensaje` de la alerta.                                           |
| `message.html`    | `titulo` y `mensaje` con el HTML escapado, más una línea fija de M.T.P.A. |

Si la alerta no trae `titulo` o `mensaje`, la función arma un texto de
respaldo con `variable`, `valor`, `limite` y `tipo`.

## Configuración requerida

Sin esto las alertas se crean y se ven en la aplicación, pero **no llega
ningún correo**:

1. Instalar la extensión **Trigger Email** (`firebase/firestore-send-email`)
   en el proyecto de Firebase.
2. Configurar la extensión con la colección de correos **`mail`** (el valor
   que usa `notificarAlerta`). Si se elige otro nombre, hay que cambiarlo
   también en `functions/index.js`.
3. Configurar en la extensión las credenciales del servidor SMTP y el
   remitente por defecto. Esos datos no se versionan en el repositorio.
4. Tener al menos un usuario `administrador` activo con `correo` válido.

## Notas

- La alerta también se muestra en la aplicación en tiempo real, sin depender
  del correo.
- La colección `mail` no tiene reglas de acceso para el cliente en
  `firestore.rules` (queda denegada por el fallback): solo escribe
  `notificarAlerta` mediante Admin SDK.
