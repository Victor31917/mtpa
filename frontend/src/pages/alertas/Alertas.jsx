import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AlertList from "../../components/alerts/AlertList";
import alertasRepository from "../../repositories/alertasRepository";
import { ALERT_STATUS, MESSAGES, ROUTES } from "../../utils/constants";
import "./Alertas.css";

// Máximo de alertas leídas (las más recientes). El filtro por estado se
// aplica en el cliente sobre esta lista.
const LIMITE_ALERTAS = 100;

const FILTRO_TODAS = "todas";

const FILTROS = [
  { valor: FILTRO_TODAS, etiqueta: "Todas" },
  { valor: ALERT_STATUS.ACTIVE, etiqueta: "Activas" },
  { valor: ALERT_STATUS.ACKNOWLEDGED, etiqueta: "Reconocidas" },
  { valor: ALERT_STATUS.RESOLVED, etiqueta: "Resueltas" },
];

const Alertas = () => {
  const navigate = useNavigate();

  const [alertas, setAlertas] = useState([]);
  const [filtro, setFiltro] = useState(FILTRO_TODAS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Suscripción única a las alertas de todas las incubadoras.
  useEffect(() => {
    const unsubscribe = alertasRepository.suscribirseAlertas(
      { limite: LIMITE_ALERTAS },
      (lista) => {
        setAlertas(lista);
        setError("");
        setLoading(false);
      },
      (err) => {
        console.error("Error al leer las alertas:", err);
        setError("No fue posible cargar las alertas.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const alertasFiltradas = useMemo(
    () =>
      filtro === FILTRO_TODAS
        ? alertas
        : alertas.filter((alerta) => alerta.estado === filtro),
    [alertas, filtro]
  );

  const contarPorFiltro = (valor) =>
    valor === FILTRO_TODAS
      ? alertas.length
      : alertas.filter((alerta) => alerta.estado === valor).length;

  const abrirDetalle = (alerta) => {
    navigate(ROUTES.ALERT_DETAIL.replace(":id", alerta.id));
  };

  const etiquetaFiltroActual = FILTROS.find(
    (opcion) => opcion.valor === filtro
  )?.etiqueta.toLowerCase();

  return (
    <section className="page alertas-page">
      <header className="page__header">
        <div className="page__header-content">
          <h1 className="page__title">Alertas</h1>
          <p className="page__subtitle">
            Alertas de todas las incubadoras, de la más reciente a la más
            antigua.
          </p>
        </div>
      </header>

      <div
        className="alertas-filtros"
        role="group"
        aria-label="Filtrar alertas por estado"
      >
        {FILTROS.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            className={`alertas-filtro${
              filtro === opcion.valor ? " alertas-filtro--activo" : ""
            }`}
            aria-pressed={filtro === opcion.valor}
            onClick={() => setFiltro(opcion.valor)}
          >
            {opcion.etiqueta} ({contarPorFiltro(opcion.valor)})
          </button>
        ))}
      </div>

      {error && (
        <div className="message message--danger alertas-mensaje" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="alertas-estado">{MESSAGES.LOADING}</p>
      ) : alertasFiltradas.length === 0 ? (
        !error && (
          <div className="card empty-state">
            <p className="empty-state__title">No hay alertas</p>
            <p className="empty-state__description">
              {filtro === FILTRO_TODAS
                ? "Todavía no se registró ninguna alerta."
                : `No hay alertas ${etiquetaFiltroActual}.`}
            </p>
          </div>
        )
      ) : (
        <AlertList alertas={alertasFiltradas} onSelect={abrirDetalle} />
      )}
    </section>
  );
};

export default Alertas;
