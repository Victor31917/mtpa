import React from "react";
import "./HumedadCard.css";

const HumedadCard = ({ medicion, umbral }) => {
  const valor = medicion?.valor;
  const fecha = medicion?.fecha;

  // Verificar si la humedad está fuera del umbral configurado.
  const fueraDeUmbral =
    umbral &&
    valor !== undefined &&
    valor !== null &&
    (valor < umbral.min || valor > umbral.max);

  const formatearHora = (fecha) => {
    if (!fecha) return "--:--";

    const date = new Date(fecha);

    if (Number.isNaN(date.getTime())) {
      return "--:--";
    }

    return date.toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className={`humedad-card ${
        fueraDeUmbral ? "humedad-card--alerta" : ""
      }`}
    >
      <div className="humedad-card__header">
        <h3>Humedad</h3>
      </div>

      <div className="humedad-card__content">
        <span className="humedad-card__valor">
          {valor !== undefined && valor !== null ? valor : "--"}
        </span>

        <span className="humedad-card__unidad">%HR</span>
      </div>

      <div className="humedad-card__hora">
        Última lectura: {formatearHora(fecha)}
      </div>

      {fueraDeUmbral && (
        <div className="humedad-card__alerta">
          Humedad fuera del umbral
        </div>
      )}
    </div>
  );
};

export default HumedadCard;