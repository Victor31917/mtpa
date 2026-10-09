import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import alertasRepository from "../../repositories/alertasRepository";
import incubadorasRepository from "../../repositories/incubadorasRepository";
import {
  ALERT_STATUS,
  ALERT_TYPES,
  ENVIRONMENTAL_VARIABLES,
  MESSAGES,
  ROUTES,
} from "../../utils/constants";
import { formatDateTime } from "../../utils/dateUtils";
import {
  capitalize,
  formatAlertStatus,
  formatAlertType,
  formatHumidity,
  formatNumber,
  formatTemperature,
} from "../../utils/formatters";
import { canManageAlerts } from "../../utils/permissions";
import "./AlertaDetalle.css";

// Valor de "resueltaPor" cuando la alerta la resuelve automáticamente
// evaluarUmbrales (Cloud Function "procesarMedicion").
const RESUELTA_POR_SISTEMA = "sistema";

// Formatea "valor", "limite" y "valorResolucion" con la unidad de la
// variable de la alerta.
const formatearSegunVariable = (variable, valor) => {
  if (variable === ENVIRONMENTAL_VARIABLES.TEMPERATURE) {
    return formatTemperature(valor);
  }

  if (variable === ENVIRONMENTAL_VARIABLES.HUMIDITY) {
    return formatHumidity(valor);
  }

  return formatNumber(valor);
};

// Nunca se muestra el mensaje crudo de Firebase: se traduce según el código.
const mensajeDeErrorAlReconocer = (err) => {
  if (
    err?.code === "permission-denied" ||
    err?.code === "unauthenticated"
  ) {
    return "No tienes permisos para cambiar el estado de esta alerta.";
  }

  if (err?.code === "unavailable") {
    return MESSAGES.CONNECTION_ERROR;
  }

  return "No fue posible marcar la alerta como reconocida. Inténtalo nuevamente.";
};

const AlertaDetalle = () => {
  const { id } = useParams();
  const { usuario } = useAuth();

  // La alerta se guarda junto al id al que pertenece: mientras no coincida
  // con el id de la ruta se considera "cargando" (sin resetear estado
  // dentro del efecto).
  const [datos, setDatos] = useState({ id: null, alerta: null, error: "" });
  const [incubadora, setIncubadora] = useState({ id: null, nombre: null });
  const [actualizando, setActualizando] = useState(false);
  const [errorAccion, setErrorAccion] = useState("");

  useEffect(() => {
    const unsubscribe = alertasRepository.suscribirseAAlerta(
      id,
      (alerta) => {
        setDatos({ id, alerta, error: "" });
      },
      (err) => {
        console.error("Error al leer la alerta:", err);
        setDatos({
          id,
          alerta: null,
          error: "No fue posible cargar la alerta.",
        });
      }
    );

    return unsubscribe;
  }, [id]);

  const cargando = datos.id !== id;
  const alerta = cargando ? null : datos.alerta;
  const incubadoraId = alerta?.incubadoraId;

  // Nombre de la incubadora: si no se puede leer se muestra su id.
  useEffect(() => {
    if (!incubadoraId) {
      return undefined;
    }

    let activo = true;

    incubadorasRepository
      .obtenerIncubadora(incubadoraId)
      .then((resultado) => {
        if (activo) {
          setIncubadora({
            id: incubadoraId,
            nombre: resultado?.nombre ?? null,
          });
        }
      })
      .catch((err) => {
        console.error("No fue posible cargar la incubadora:", err);
      });

    return () => {
      activo = false;
    };
  }, [incubadoraId]);

  const handleReconocer = async () => {
    try {
      setActualizando(true);
      setErrorAccion("");

      // El cambio llega a la pantalla por la suscripción en tiempo real.
      await alertasRepository.actualizarEstado(id, ALERT_STATUS.ACKNOWLEDGED);
    } catch (err) {
      console.error("No fue posible reconocer la alerta:", err);
      setErrorAccion(mensajeDeErrorAlReconocer(err));
    } finally {
      setActualizando(false);
    }
  };

  const volver = (
    <Link to={ROUTES.ALERTS} className="alerta-detalle__volver">
      ← Volver al listado
    </Link>
  );

  if (cargando) {
    return (
      <section className="page alerta-detalle-page">
        {volver}
        <p className="alerta-detalle__estado">{MESSAGES.LOADING}</p>
      </section>
    );
  }

  if (datos.error) {
    return (
      <section className="page alerta-detalle-page">
        {volver}
        <div className="message message--danger" role="alert">
          {datos.error}
        </div>
      </section>
    );
  }

  if (!alerta) {
    return (
      <section className="page alerta-detalle-page">
        {volver}
        <div className="card empty-state">
          <p className="empty-state__title">Alerta no encontrada</p>
          <p className="empty-state__description">
            La alerta indicada no existe o fue eliminada.
          </p>
        </div>
      </section>
    );
  }

  const nombreIncubadora =
    incubadora.id === alerta.incubadoraId && incubadora.nombre
      ? incubadora.nombre
      : alerta.incubadoraId || "-";

  const puedeReconocer =
    alerta.estado === ALERT_STATUS.ACTIVE && canManageAlerts(usuario);

  // La alerta de desconexión no tiene variable, valor ni límite: se
  // muestra el dispositivo y desde cuándo no envía señales.
  const esDesconexion = alerta.tipo === ALERT_TYPES.DEVICE_DISCONNECTED;

  return (
    <section className="page alerta-detalle-page">
      {volver}

      <article className="card alerta-detalle">
        <header className="alerta-detalle__encabezado">
          <div>
            <h1 className="alerta-detalle__titulo">
              {alerta.titulo || formatAlertType(alerta.tipo)}
            </h1>

            {alerta.mensaje && (
              <p className="alerta-detalle__mensaje">{alerta.mensaje}</p>
            )}
          </div>

          <span
            className={`alerta-detalle__badge alerta-detalle__badge--${
              alerta.estado || "desconocido"
            }`}
          >
            {formatAlertStatus(alerta.estado)}
          </span>
        </header>

        <dl className="alerta-detalle__lista">
          <div className="alerta-detalle__fila">
            <dt>Incubadora</dt>
            <dd>{nombreIncubadora}</dd>
          </div>

          {esDesconexion ? (
            <>
              <div className="alerta-detalle__fila">
                <dt>Dispositivo</dt>
                <dd>{alerta.dispositivoId || "-"}</dd>
              </div>

              <div className="alerta-detalle__fila">
                <dt>Sin señales desde</dt>
                <dd>{formatDateTime(alerta.ultimaSenalEn)}</dd>
              </div>
            </>
          ) : (
            <>
              <div className="alerta-detalle__fila">
                <dt>Variable</dt>
                <dd>{capitalize(alerta.variable) || "-"}</dd>
              </div>

              <div className="alerta-detalle__fila">
                <dt>Valor registrado</dt>
                <dd>
                  {formatearSegunVariable(alerta.variable, alerta.valor)}
                </dd>
              </div>

              <div className="alerta-detalle__fila">
                <dt>Límite excedido</dt>
                <dd>
                  {formatearSegunVariable(alerta.variable, alerta.limite)}
                </dd>
              </div>
            </>
          )}

          <div className="alerta-detalle__fila">
            <dt>Tipo</dt>
            <dd>{formatAlertType(alerta.tipo)}</dd>
          </div>

          <div className="alerta-detalle__fila">
            <dt>Estado</dt>
            <dd>{formatAlertStatus(alerta.estado)}</dd>
          </div>

          <div className="alerta-detalle__fila">
            <dt>Generada el</dt>
            <dd>{formatDateTime(alerta.creadaEn)}</dd>
          </div>
        </dl>

        {alerta.estado === ALERT_STATUS.RESOLVED && (
          <div className="alerta-detalle__resolucion">
            <p className="alerta-detalle__resolucion-titulo">
              {alerta.resueltaPor === RESUELTA_POR_SISTEMA
                ? "Resuelta automáticamente"
                : "Resuelta"}
            </p>

            <p className="alerta-detalle__resolucion-texto">
              {formatDateTime(alerta.resueltaEn)}
            </p>

            {esDesconexion && alerta.resueltaPor === RESUELTA_POR_SISTEMA && (
              <p className="alerta-detalle__resolucion-texto">
                El dispositivo volvió a comunicarse
              </p>
            )}

            {!esDesconexion && typeof alerta.valorResolucion === "number" && (
              <p className="alerta-detalle__resolucion-texto">
                La medición volvió a{" "}
                {formatearSegunVariable(
                  alerta.variable,
                  alerta.valorResolucion
                )}
              </p>
            )}
          </div>
        )}

        {errorAccion && (
          <div className="message message--danger" role="alert">
            {errorAccion}
          </div>
        )}

        {puedeReconocer && (
          <div className="card__footer">
            <button
              type="button"
              className="alerta-detalle__boton"
              onClick={handleReconocer}
              disabled={actualizando}
            >
              {actualizando ? MESSAGES.SAVING : "Marcar como reconocida"}
            </button>
          </div>
        )}
      </article>
    </section>
  );
};

export default AlertaDetalle;
