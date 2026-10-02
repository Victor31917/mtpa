import { UNITS } from "../../utils/constants";
import "./TemperatureCard.css";

const TemperatureCard = ({
  medicion,
}) => {
  return (
    <article className="dashboard-card">
      <div className="dashboard-card__header">
        <h3>Temperatura</h3>
        <span>Ambiente</span>
      </div>

      <strong className="dashboard-card__value">
        {medicion?.valor ?? "--"}{" "}
        {medicion
          ? UNITS.TEMPERATURE
          : ""}
      </strong>

      <p>
        {medicion
          ? "Última lectura recibida."
          : "Sin mediciones disponibles."}
      </p>
    </article>
  );
};

export default TemperatureCard;