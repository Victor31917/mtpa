import { useEffect, useState } from "react";
import "./ConnectionStatus.css";

function calcularTiempoTranscurrido(fecha) {
  if (!fecha) {
    return "Sin información";
  }

  let fechaComunicacion;

  // Soporta Date, timestamp de Firestore y fechas en formato string.
  if (fecha instanceof Date) {
    fechaComunicacion = fecha;
  } else if (typeof fecha?.toDate === "function") {
    fechaComunicacion = fecha.toDate();
  } else {
    fechaComunicacion = new Date(fecha);
  }

  if (Number.isNaN(fechaComunicacion.getTime())) {
    return "Fecha no disponible";
  }

  const ahora = new Date();
  const diferenciaMs = Math.max(
    0,
    ahora.getTime() - fechaComunicacion.getTime()
  );

  const segundos = Math.floor(diferenciaMs / 1000);
  const minutos = Math.floor(segundos / 60);
  const horas = Math.floor(minutos / 60);
  const dias = Math.floor(horas / 24);

  if (segundos < 60) {
    return "hace unos segundos";
  }

  if (minutos < 60) {
    return `hace ${minutos} ${minutos === 1 ? "minuto" : "minutos"}`;
  }

  if (horas < 24) {
    return `hace ${horas} ${horas === 1 ? "hora" : "horas"}`;
  }

  return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
}

function ConnectionStatus({
  estadoConexion = "desconectado",
  ultimaComunicacionEn = null,
}) {
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(() =>
    calcularTiempoTranscurrido(ultimaComunicacionEn)
  );

  useEffect(() => {
    setTiempoTranscurrido(
      calcularTiempoTranscurrido(ultimaComunicacionEn)
    );

    // Actualiza el texto cada minuto.
    const interval = setInterval(() => {
      setTiempoTranscurrido(
        calcularTiempoTranscurrido(ultimaComunicacionEn)
      );
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [ultimaComunicacionEn]);

  const conectado = estadoConexion === "conectado";

  return (
    <section
      className={`connection-status ${
        conectado
          ? "connection-status--connected"
          : "connection-status--disconnected"
      }`}
      aria-label={`Estado de conexión: ${
        conectado ? "conectado" : "desconectado"
      }`}
    >
      <div
        className="connection-status__indicator"
        aria-hidden="true"
      >
        {conectado ? "✓" : "!"}
      </div>

      <div className="connection-status__content">
        <div className="connection-status__header">
          <span className="connection-status__label">
            Estado de conexión
          </span>

          <span className="connection-status__state">
            {conectado ? "Conectado" : "Desconectado"}
          </span>
        </div>

        <p className="connection-status__last-communication">
          Última comunicación: {tiempoTranscurrido}
        </p>
      </div>
    </section>
  );
}

export default ConnectionStatus;

