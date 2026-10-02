import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { alertasRepository } from "../../repositories/alertasRepository";
import { ROUTES } from "../../routes/routes";
import "./AlertaDetalle.css";

export default function AlertaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [alerta, setAlerta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;

    const cargarAlerta = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await alertasRepository.obtenerPorId(id);

        if (activo) {
          setAlerta(data);
        }
      } catch (err) {
        if (activo) {
          setError("No fue posible cargar la alerta.");
        }
      } finally {
        if (activo) {
          setLoading(false);
        }
      }
    };

    cargarAlerta();

    return () => {
      activo = false;
    };
  }, [id]);

  if (loading) {
    return (
      <section className="alerta-detalle">
        <p>Cargando alerta...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="alerta-detalle">
        <p className="alerta-detalle__error" role="alert">
          {error}
        </p>

        <button onClick={() => navigate(ROUTES.ALERTAS)}>
          Volver a alertas
        </button>
      </section>
    );
  }

  if (!alerta) {
    return (
      <section className="alerta-detalle">
        <p>La alerta no existe.</p>

        <button onClick={() => navigate(ROUTES.ALERTAS)}>
          Volver a alertas
        </button>
      </section>
    );
  }

  return (
    <section className="alerta-detalle">
      <header className="alerta-detalle__header">
        <button
          type="button"
          onClick={() => navigate(ROUTES.ALERTAS)}
        >
          ← Volver
        </button>

        <span
          className={`alerta-detalle__estado alerta-detalle__estado--${alerta.estado}`}
        >
          {alerta.estado}
        </span>
      </header>

      <div className="alerta-detalle__card">
        <h1>{alerta.titulo || "Detalle de alerta"}</h1>

        <dl>
          <div>
            <dt>Incubadora</dt>
            <dd>{alerta.incubadoraId || "No especificada"}</dd>
          </div>

          <div>
            <dt>Variable</dt>
            <dd>{alerta.variable || "No especificada"}</dd>
          </div>

          <div>
            <dt>Valor registrado</dt>
            <dd>{alerta.valor ?? "No disponible"}</dd>
          </div>

          <div>
            <dt>Descripción</dt>
            <dd>
              {alerta.descripcion ||
                alerta.mensaje ||
                "Sin descripción"}
            </dd>
          </div>

          <div>
            <dt>Fecha</dt>
            <dd>
              {alerta.fecha
                ? new Date(alerta.fecha).toLocaleString("es-CO")
                : "No disponible"}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}