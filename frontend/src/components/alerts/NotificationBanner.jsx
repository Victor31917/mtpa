jsx
import { useEffect, useState } from "react";
import * as alertasRepository from "../../repositories/alertasRepository";
import "./NotificationBanner.css";

function NotificationBanner() {
  const [alerta, setAlerta] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let unsubscribe;

    try {
      // Se suscribe únicamente a las alertas nuevas.
      unsubscribe = alertasRepository.subscribeAlertas(
        (alertas) => {
          if (!alertas || alertas.length === 0) {
            setAlerta(null);
            return;
          }

          // Mostramos la primera alerta nueva.
          setAlerta(alertas[0]);
          setDismissed(false);
        },
        { estado: "nueva" }
      );
    } catch (error) {
      console.error("Error al suscribirse a las alertas:", error);
    }

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  // No mostrar nada si no hay alerta o si el usuario la descartó.
  if (!alerta || dismissed) {
    return null;
  }

  const mensaje =
    alerta.mensaje ||
    alerta.descripcion ||
    alerta.texto ||
    "Tienes una nueva notificación.";

  const titulo = alerta.titulo || "Nueva notificación";

  return (
    <div className="notification-banner" role="alert">
      <div className="notification-banner__icon" aria-hidden="true">
        🔔
      </div>

      <div className="notification-banner__content">
        <strong className="notification-banner__title">{titulo}</strong>
        <p className="notification-banner__message">{mensaje}</p>
      </div>

      <button
        type="button"
        className="notification-banner__dismiss"
        onClick={() => setDismissed(true)}
        aria-label="Descartar notificación"
      >
        ×
      </button>
    </div>
  );
}

export default NotificationBanner;

