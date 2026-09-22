import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { alertasRepository } from "../../repositories/alertasRepository";
import { ROUTES } from "../../routes/routes";
import "./NotificationBanner.css";

export default function NotificationBanner() {
  const [alertaNueva, setAlertaNueva] = useState(null);

  useEffect(() => {
    const unsubscribe = alertasRepository.suscribirseAlertasNuevas(
      (alerta) => {
        if (alerta) {
          setAlertaNueva(alerta);
        }
      }
    );

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  if (!alertaNueva) {
    return null;
  }

  return (
    <aside className="notification-banner" role="alert">
      <div className="notification-banner__content">
        <strong>Nueva alerta</strong>

        <span>
          {alertaNueva.titulo ||
            alertaNueva.descripcion ||
            alertaNueva.mensaje ||
            "Se generó una nueva alerta."}
        </span>
      </div>

      <div className="notification-banner__actions">
        <Link to={`${ROUTES.ALERTAS}/${alertaNueva.id}`}>
          Ver alerta
        </Link>

        <button
          type="button"
          onClick={() => setAlertaNueva(null)}
          aria-label="Cerrar notificación"
        >
          ×
        </button>
      </div>
    </aside>
  );
}