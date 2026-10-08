import { ALERT_TYPES } from "../../utils/constants";
import { formatDateTime } from "../../utils/dateUtils";
import {
  formatAlertStatus,
  formatAlertType,
} from "../../utils/formatters";
import "./AlertCard.css";

// Indicador visual por tipo de alerta: icono y variante de color.
const INDICADOR_POR_TIPO = {
  [ALERT_TYPES.HIGH_TEMPERATURE]: { icono: "🌡️", variante: "alta" },
  [ALERT_TYPES.LOW_TEMPERATURE]: { icono: "🌡️", variante: "baja" },
  [ALERT_TYPES.HIGH_HUMIDITY]: { icono: "💧", variante: "alta" },
  [ALERT_TYPES.LOW_HUMIDITY]: { icono: "💧", variante: "baja" },
  [ALERT_TYPES.DEVICE_DISCONNECTED]: { icono: "📡", variante: "conexion" },
  [ALERT_TYPES.COMMUNICATION_LOST]: { icono: "📡", variante: "conexion" },
};

const INDICADOR_POR_DEFECTO = { icono: "🔔", variante: "sistema" };

// Props:
// - alerta: documento de alerta { id, titulo, mensaje, tipo, estado,
//   creadaEn, medidoEn }
// - onClick (opcional): se invoca con la alerta al pulsar la tarjeta
function AlertCard({ alerta, onClick }) {
  if (!alerta) {
    return null;
  }

  const { icono, variante } =
    INDICADOR_POR_TIPO[alerta.tipo] || INDICADOR_POR_DEFECTO;

  const titulo = alerta.titulo || formatAlertType(alerta.tipo);
  const fecha = formatDateTime(alerta.creadaEn || alerta.medidoEn);

  const interactiva = typeof onClick === "function";

  const manejarTeclado = (evento) => {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      onClick(alerta);
    }
  };

  return (
    <article
      className={`alert-card alert-card--${variante}${
        interactiva ? " alert-card--clickable" : ""
      }`}
      onClick={interactiva ? () => onClick(alerta) : undefined}
      onKeyDown={interactiva ? manejarTeclado : undefined}
      role={interactiva ? "button" : undefined}
      tabIndex={interactiva ? 0 : undefined}
    >
      <div className="alert-card__indicator" aria-hidden="true">
        {icono}
      </div>

      <div className="alert-card__content">
        <div className="alert-card__header">
          <strong className="alert-card__title">{titulo}</strong>

          <span
            className={`alert-card__status alert-card__status--${
              alerta.estado || "desconocido"
            }`}
          >
            {formatAlertStatus(alerta.estado)}
          </span>
        </div>

        {alerta.mensaje && (
          <p className="alert-card__message">{alerta.mensaje}</p>
        )}

        <p className="alert-card__date">{fecha}</p>
      </div>
    </article>
  );
}

export default AlertCard;
