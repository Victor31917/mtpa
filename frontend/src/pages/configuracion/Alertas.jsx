import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { alertasRepository } from "../../repositories/alertasRepository";
import { ROUTES } from "../../routes/routes";
import "./Alertas.css";

const ESTADOS = [
  { value: "todas", label: "Todas" },
  { value: "nueva", label: "Nuevas" },
  { value: "vista", label: "Vistas" },
  { value: "resuelta", label: "Resueltas" },
];

export default function Alertas() {
  const [alertas, setAlertas] = useState([]);
  const [estadoFiltro, setEstadoFiltro] = useState("todas");
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");

    const unsubscribe = alertasRepository.suscribirseAlertas(
      (nuevasAlertas) => {
        setAlertas(nuevasAlertas || []);
      },
      () => {
        setError("No fue posible cargar las alertas.");
      }
    );

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  const alertasFiltradas =
    estadoFiltro === "todas"
      ? alertas
      : alertas.filter((alerta) => alerta.estado === estadoFiltro);

  return (
    <section className="alertas">
      <header className="alertas__header">
        <div>
          <h1>Alertas</h1>
          <p>Alertas generadas por las incubadoras.</p>
        </div>

        <div className="alertas__filtro">
          <label htmlFor="estado-alerta">Estado</label>

          <select
            id="estado-alerta"
            value={estadoFiltro}
            onChange={(event) => setEstadoFiltro(event.target.value)}
          >
            {ESTADOS.map((estado) => (
              <option key={estado.value} value={estado.value}>
                {estado.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {error && (
        <p className="alertas__error" role="alert">
          {error}
        </p>
      )}

      {alertasFiltradas.length === 0 ? (
        <p className="alertas__empty">
          No hay alertas para el filtro seleccionado.
        </p>
      ) : (
        <div className="alertas__list">
          {alertasFiltradas.map((alerta) => (
            <article key={alerta.id} className="alerta-card">
              <div>
                <span className={`alerta-card__estado alerta-card__estado--${alerta.estado}`}>
                  {alerta.estado}
                </span>

                <h2>{alerta.titulo || "Alerta"}</h2>

                <p>
                  {alerta.descripcion || alerta.mensaje || "Sin descripción"}
                </p>
              </div>

              <Link
                to={`${ROUTES.ALERTAS}/${alerta.id}`}
                className="alerta-card__link"
              >
                Ver detalle
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}