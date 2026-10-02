import "./LastUpdateCard.css";

const formatDate = (value) => {
  if (!value) {
    return "Sin datos";
  }

  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sin datos";
  }

  return new Intl.DateTimeFormat(
    "es-CO",
    {
      dateStyle: "short",
      timeStyle: "medium",
    }
  ).format(date);
};

const LastUpdateCard = ({
  medicion,
}) => {
  return (
    <article className="dashboard-card">
      <div className="dashboard-card__header">
        <h3>Última actualización</h3>
      </div>

      <strong className="dashboard-card__value dashboard-card__value--small">
        {formatDate(
          medicion?.medidoEn
        )}
      </strong>

      <p>
        {medicion
          ? `Variable: ${medicion.variable}`
          : "Sin mediciones."}
      </p>
    </article>
  );
};

export default LastUpdateCard;