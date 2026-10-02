import "./GeneralStatusCard.css";

const LABELS = {
  normal: "Normal",
  advertencia: "Advertencia",
  critico: "Crítico",
  sin_datos: "Sin datos",
};

const GeneralStatusCard = ({
  incubadora,
  estado,
  temperatura,
  humedad,
  dispositivos = [],
}) => {
  return (
    <article className="dashboard-card dashboard-card--general">
      <div className="dashboard-card__header">
        <h3>Estado general</h3>

        <span>
          {incubadora?.estado ||
            "sin estado"}
        </span>
      </div>

      <strong className="dashboard-card__value">
        {LABELS[estado] || "Sin datos"}
      </strong>

      <p>
        {temperatura && humedad
          ? "Temperatura y humedad disponibles."
          : "Faltan mediciones ambientales."}
      </p>

      <small>
        Dispositivos: {dispositivos.length}
      </small>
    </article>
  );
};

export default GeneralStatusCard;