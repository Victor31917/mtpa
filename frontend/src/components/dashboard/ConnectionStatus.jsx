import "./ConnectionStatus.css";

const ConnectionStatus = ({
  dispositivos = [],
}) => {
  const conectados =
    dispositivos.filter(
      (dispositivo) =>
        dispositivo.estadoConexion ===
        "conectado"
    ).length;

  const desconectados =
    dispositivos.filter(
      (dispositivo) =>
        dispositivo.estadoConexion ===
        "desconectado"
    ).length;

  const total = dispositivos.length;

  return (
    <article className="dashboard-card">
      <div className="dashboard-card__header">
        <h3>Conexión</h3>
      </div>

      <strong className="dashboard-card__value">
        {total > 0
          ? `${conectados}/${total}`
          : "--"}
      </strong>

      <p>
        {total === 0
          ? "Sin dispositivos registrados."
          : desconectados > 0
            ? `${desconectados} dispositivo(s) desconectado(s).`
            : "Todos los dispositivos están conectados."}
      </p>
    </article>
  );
};

export default ConnectionStatus;