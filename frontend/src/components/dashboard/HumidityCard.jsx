import "./HumidityCard.css";

const HumidityCard = ({
  medicion,
}) => {
  return (
    <article className="dashboard-card">
      <div className="dashboard-card__header">
        <h3>Humedad</h3>
        <span>Ambiente</span>
      </div>

      <strong className="dashboard-card__value">
        {medicion?.valor ?? "--"}{" "}
        {medicion ? "%" : ""}
      </strong>

      <p>
        {medicion
          ? "Última lectura recibida."
          : "Sin mediciones disponibles."}
      </p>
    </article>
  );
};

export default HumidityCard;