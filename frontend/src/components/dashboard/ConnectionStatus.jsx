import React from "react";
import "./EstadoConexionCard.css";

const EstadoConexionCard = ({
  estadoConexion,
  ultimaComunicacionEn,
}) => {
  const conectado = estadoConexion === "conectado";

  const calcularTiempoTranscurrido = (fecha) => {
    if (!fecha) return "Sin comunicación registrada";

    const fechaComunicacion = new Date(fecha);

    if (Number.isNaN(fechaComunicacion.getTime())) {
      return "Fecha no disponible";
    }

    const ahora = new Date();
    const diferencia = Math.max(
      0,
      ahora.getTime() - fechaComunicacion.getTime()
    );

    const segundos = Math.floor(diferencia / 1000);
    const minutos = Math.floor(segundos / 60);
    const horas = Math.floor(minutos / 60);
    const dias = Math.floor(horas / 24);

    if (dias > 0) {
      return `Hace ${dias} ${dias === 1 ? "día" : "días"}`;
    }

    if (horas > 0) {
      return `Hace ${horas} ${horas === 1 ? "hora" : "horas"}`;
    }

    if (minutos > 0) {
      return `Hace ${minutos} ${minutos === 1 ? "minuto" : "minutos"}`;
    }

    return "Hace unos segundos";
  };

  return (
    <div
      className={`estado-conexion-card ${
        conectado
          ? "estado-conexion-card--conectado"
          : "estado-conexion-card--desconectado"
      }`}
    >
      <div className="estado-conexion-card__header">
        <h3>Estado de conexión</h3>
      </div>

      <div className="estado-conexion-card__estado">
        <span className="estado-conexion-card__icono" aria-hidden="true">
          {conectado ? "●" : "●"}
        </span>

        <span className="estado-conexion-card__texto">
          {conectado ? "Conectado" : "Desconectado"}
        </span>
      </div>

      <div className="estado-conexion-card__comunicacion">
        <span>Última comunicación:</span>
        <strong>
          {calcularTiempoTranscurrido(ultimaComunicacionEn)}
        </strong>
      </div>
    </div>
  );
};

export default EstadoConexionCard;