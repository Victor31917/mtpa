import { formatTime } from "../../utils/dateUtils";
import "./HumidityCard.css";

// Props:
// - medicion: última medición de humedad { valor, unidad, medidoEn }
// - umbral (opcional): { min, max } para resaltar valores fuera de rango
const HumidityCard = ({ medicion, umbral }) => {
  const valor = medicion?.valor;
  const medidoEn = medicion?.medidoEn;

  // Verificar si la humedad está fuera del umbral configurado.
  const fueraDeUmbral =
    umbral &&
    valor !== undefined &&
    valor !== null &&
    (valor < umbral.min || valor > umbral.max);

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
        Última lectura: {medidoEn ? formatTime(medidoEn) : "--:--"}
      </div>

      {fueraDeUmbral && (
        <div className="humedad-card__alerta">
          Humedad fuera del umbral
        </div>
      )}
    </div>
  );
};

export default HumidityCard;
