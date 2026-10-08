import { formatTime } from "../../utils/dateUtils";
import "./TemperatureCard.css";

// Props:
// - medicion: última medición de temperatura { valor, unidad, medidoEn }
// - umbral (opcional): { min, max } para resaltar valores fuera de rango
const TemperatureCard = ({ medicion, umbral }) => {
  const valor = medicion?.valor;
  const medidoEn = medicion?.medidoEn;

  const fueraDeUmbral =
    umbral &&
    valor !== undefined &&
    valor !== null &&
    (valor < umbral.min || valor > umbral.max);

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
        Última lectura: {medidoEn ? formatTime(medidoEn) : "--:--"}
      </div>

      {fueraDeUmbral && (
        <div className="temperatura-card__alerta">
          Temperatura fuera del umbral
        </div>
      )}
    </div>
  );
};

export default TemperatureCard;
