import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import alertasRepository from "../../repositories/alertasRepository";
import { ALERT_STATUS, ROUTES } from "../../utils/constants";
import "./NotificationBanner.css";

function NotificationBanner() {
  const [alerta, setAlerta] = useState(null);
  const [descartadaId, setDescartadaId] = useState(null);

  useEffect(() => {
    let unsubscribe;

    try {
      // Se suscribe únicamente a las alertas activas (las más recientes primero).
      unsubscribe = alertasRepository.suscribirseAlertas(
        { estado: ALERT_STATUS.ACTIVE, limite: 20 },
        (alertas) => {
          // Mostramos la alerta activa más reciente.
          setAlerta(alertas && alertas.length > 0 ? alertas[0] : null);
        },
        (error) => {
          // Un fallo de la suscripción no debe romper el layout.
          console.error("Error al leer las alertas:", error);
          setAlerta(null);
        }
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

  // No mostrar nada si no hay alerta o si el usuario ya descartó esta.
  if (!alerta || alerta.id === descartadaId) {
    return null;
  }

  const mensaje = alerta.mensaje || "Tienes una nueva notificación.";

  const titulo = alerta.titulo || "Nueva notificación";

  return (
    <div className="notification-banner" role="alert">
      <div className="notification-banner__icon" aria-hidden="true">
        🔔
      </div>

      <div className="notification-banner__content">
        <strong className="notification-banner__title">{titulo}</strong>
        <p className="notification-banner__message">{mensaje}</p>
        <Link
          to={ROUTES.ALERT_DETAIL.replace(":id", alerta.id)}
          className="notification-banner__link"
        >
          Ver alerta
        </Link>
      </div>

      <button
        type="button"
        className="notification-banner__dismiss"
        onClick={() => setDescartadaId(alerta.id)}
        aria-label="Descartar notificación"
      >
        ×
      </button>
    </div>
  );
}

export default NotificationBanner;
