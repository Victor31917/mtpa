import React from "react";
import "./TemperaturaCard.css";

const TemperaturaCard = ({ medicion, umbral }) => {
  const valor = medicion?.valor;
  const fecha = medicion?.fecha;

  // TODO: cuando Dashboard.jsx envíe el umbral, validar:
  // valor < umbral.min || valor > umbral.max

  const fueraDeUmbral =
    umbral &&
    valor !== undefined &&
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
      className={`temperatura-card ${
        fueraDeUmbral ? "temperatura-card--alerta" : ""
      }`}
    >
      <div className="temperatura-card__header">
        <h3>Temperatura</h3>
      </div>

      <div className="temperatura-card__content">
        <span className="temperatura-card__valor">
          {valor !== undefined && valor !== null ? valor : "--"}
        </span>

        <span className="temperatura-card__unidad">°C</span>
      </div>

      <div className="temperatura-card__hora">
        Última lectura: {formatearHora(fecha)}
      </div>

      {fueraDeUmbral && (
        <div className="temperatura-card__alerta">
          Temperatura fuera del umbral
        </div>
      )}
    </div>
  );
};

export default TemperaturaCard;