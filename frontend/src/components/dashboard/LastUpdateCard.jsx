import React, { useEffect, useState } from "react";
import {
  timeAgo,
  formatDateTime,
  isValidDate,
} from "../../utils/dateutils";
import "./LastUpdateCard.css";

const LastUpdateCard = ({ ultimaMedicionEn }) => {
  const [ahora, setAhora] = useState(() => new Date());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setAhora(new Date());
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  const fechaValida = isValidDate(ultimaMedicionEn);

  const tiempoRelativo = fechaValida
    ? timeAgo(ultimaMedicionEn, ahora)
    : "Sin mediciones registradas";

  const fechaCompleta = fechaValida
    ? formatDateTime(ultimaMedicionEn)
    : "Fecha no disponible";

  return (
    <section
      className="last-update-card"
      aria-label="Última actualización"
    >
      <div className="last-update-card__icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </div>

      <div className="last-update-card__content">
        <h3 className="last-update-card__title">
          Última actualización
        </h3>

        <p className="last-update-card__relative">
          {tiempoRelativo}
        </p>

        <p className="last-update-card__date">
          {fechaCompleta}
        </p>
      </div>
    </section>
  );
};

export default LastUpdateCard;
