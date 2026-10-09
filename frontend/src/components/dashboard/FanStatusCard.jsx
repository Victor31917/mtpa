import "./FanStatusCard.css";

const FanStatusCard = ({
  ventiladores = [],
}) => {
  const conectados =
    ventiladores.filter(
      (ventilador) =>
        ventilador.estadoConexion ===
        "conectado"
    ).length;

  const desconectados =
    ventiladores.length -
    conectados;

  return (
    <article className="dashboard-card dashboard-card--fans">
      <div className="dashboard-card__header">
        <h3>Ventiladores</h3>
      </div>

      <strong className="dashboard-card__value">
        {ventiladores.length
          ? `${conectados}/${ventiladores.length}`
          : "--"}
      </strong>

      <p>
        {ventiladores.length
          ? desconectados
            ? `${desconectados} sin conexión.`
            : "Todos conectados."
          : "Sin ventiladores registrados."}
      </p>
    </article>
  );
};

export default FanStatusCard;