import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import incubadorasRepository from "../../repositories/incubadorasRepository";
import ordenesRepository from "../../repositories/ordenesRepository";
import ventiladoresRepository from "../../repositories/ventiladoresRepository";
import {
  COMMAND_STATUS,
  FAN_ACTIONS,
  FAN_CONTROL_MODE,
  FAN_STATUS,
  INCUBATOR_STATUS,
  MESSAGES,
  ROUTES,
} from "../../utils/constants";
import { formatDateTime } from "../../utils/dateUtils";
import {
  formatFanControlMode,
  formatFanStatus,
  formatShortId,
} from "../../utils/formatters";
import { canControlFans, canManageAutomation } from "../../utils/permissions";
import "./ControlVentiladores.css";

// Texto y variante visual de cada estado de una orden (COMMAND_STATUS).
// La variante es una de las de global.css (.status--*, .message--*).
const ESTADOS_ORDEN = {
  [COMMAND_STATUS.PENDING]: {
    etiqueta: "Pendiente",
    variante: "info",
    descripcion: "A la espera de que el servicio de integración la tome.",
  },
  [COMMAND_STATUS.SENDING]: {
    etiqueta: "Enviando",
    variante: "info",
    descripcion: "El servicio de integración la está publicando.",
  },
  [COMMAND_STATUS.SENT]: {
    etiqueta: "Enviada",
    variante: "info",
    descripcion: "Publicada; falta la confirmación del dispositivo.",
  },
  [COMMAND_STATUS.EXECUTED]: {
    etiqueta: "Ejecutada",
    variante: "success",
    descripcion: "El dispositivo confirmó el cambio.",
  },
  [COMMAND_STATUS.FAILED]: {
    etiqueta: "Fallida",
    variante: "danger",
    descripcion: "La orden no pudo enviarse al dispositivo.",
  },
  [COMMAND_STATUS.EXPIRED]: {
    etiqueta: "Expirada",
    variante: "warning",
    descripcion: "No se envió a tiempo y se descartó.",
  },
};

const ESTADO_ORDEN_DESCONOCIDO = {
  etiqueta: "Desconocido",
  variante: "muted",
  descripcion: "",
};

// Una orden en estos estados todavía no salió hacia el dispositivo: mientras
// tanto no se admite otro comando. "enviada" no bloquea porque la confirmación
// ("ejecutada") puede no llegar nunca y el panel quedaría inutilizable.
const ESTADOS_ORDEN_EN_CURSO = [COMMAND_STATUS.PENDING, COMMAND_STATUS.SENDING];

// Estados terminales con error: se muestran en un bloque aparte para que no
// se confundan con una orden que sigue su curso.
const ESTADOS_ORDEN_FALLIDOS = [COMMAND_STATUS.FAILED, COMMAND_STATUS.EXPIRED];

const ETIQUETAS_ACCION = {
  [FAN_ACTIONS.TURN_ON]: "Encender",
  [FAN_ACTIONS.TURN_OFF]: "Apagar",
};

const obtenerEstadoOrden = (estado) =>
  ESTADOS_ORDEN[estado] ?? ESTADO_ORDEN_DESCONOCIDO;

// "estadoActual" es null hasta que el dispositivo confirma un estado: se
// muestra como "Desconocido", nunca como "Apagado".
const obtenerEstadoVentilador = (estadoActual) => {
  if (estadoActual === FAN_STATUS.ON) {
    return { etiqueta: formatFanStatus(estadoActual), clase: "encendido" };
  }

  if (estadoActual === FAN_STATUS.OFF) {
    return { etiqueta: formatFanStatus(estadoActual), clase: "apagado" };
  }

  return { etiqueta: "Desconocido", clase: "desconocido" };
};

// Indica si hay un comando en curso desde esta pantalla, para evitar el doble
// envío: la llamada a la callable sigue en vuelo, la orden recién creada
// todavía no llegó por la suscripción (la última orden sigue siendo la de
// antes de enviar) o la última orden aún no salió hacia el dispositivo.
const hayOrdenEnCurso = ({
  accionEnCurso,
  ordenPrevia,
  errorOrdenes,
  ultima,
}) => {
  if (accionEnCurso !== "") {
    return true;
  }

  if (
    ordenPrevia !== undefined &&
    !errorOrdenes &&
    (ultima?.id ?? null) === ordenPrevia
  ) {
    return true;
  }

  return ESTADOS_ORDEN_EN_CURSO.includes(ultima?.estado);
};

// Decide si los botones de encender/apagar están habilitados y, si no, por
// qué. Los comandos manuales solo se admiten en modo manual o mixto (igual
// que la Cloud Function) y solo a quien tiene permiso de control.
const evaluarControl = ({ modoControl, puedeControlar, ordenEnCurso }) => {
  if (!puedeControlar) {
    return {
      habilitado: false,
      motivo: "Su rol solo permite consultar el estado de los ventiladores.",
    };
  }

  if (modoControl === FAN_CONTROL_MODE.AUTOMATIC) {
    return {
      habilitado: false,
      motivo:
        "El ventilador está en modo automático y no admite comandos manuales.",
    };
  }

  if (
    modoControl !== FAN_CONTROL_MODE.MANUAL &&
    modoControl !== FAN_CONTROL_MODE.MIXED
  ) {
    return {
      habilitado: false,
      motivo: "El modo de control del ventilador no permite comandos manuales.",
    };
  }

  if (ordenEnCurso) {
    return {
      habilitado: false,
      motivo: "Hay una orden en curso; espere a que termine para enviar otra.",
    };
  }

  return { habilitado: true, motivo: "" };
};

// Mensaje legible para el error de la callable "enviarComandoVentilador".
// Los errores de negocio (ventilador en automático, inexistente, sin
// incubadora asociada) traen un texto propio en español; el resto se traduce
// según el código para no mostrar el mensaje crudo de Firebase.
const mensajeDeErrorAlEnviar = (err) => {
  const codigo = String(err?.code ?? "").replace("functions/", "");

  if (codigo === "unauthenticated" || codigo === "permission-denied") {
    return "No tienes permisos para enviar comandos a los ventiladores.";
  }

  if (
    codigo === "failed-precondition" ||
    codigo === "not-found" ||
    codigo === "invalid-argument"
  ) {
    if (typeof err?.message === "string" && err.message.trim() !== "") {
      return err.message;
    }
  }

  if (codigo === "unavailable" || codigo === "deadline-exceeded") {
    return MESSAGES.CONNECTION_ERROR;
  }

  return "No fue posible enviar el comando. Inténtalo nuevamente.";
};

const UltimaOrden = ({ cargando, error, orden }) => {
  if (cargando) {
    return <p className="ventiladores-orden__texto">{MESSAGES.LOADING}</p>;
  }

  if (error) {
    return (
      <p className="ventiladores-orden__texto text-danger">{error}</p>
    );
  }

  if (!orden) {
    return (
      <p className="ventiladores-orden__texto">
        Todavía no se envió ninguna orden.
      </p>
    );
  }

  const estado = obtenerEstadoOrden(orden.estado);
  const falla = ESTADOS_ORDEN_FALLIDOS.includes(orden.estado);
  const accion = ETIQUETAS_ACCION[orden.accionSolicitada] ?? "-";

  return (
    <>
      <p className="ventiladores-orden__texto">
        {accion} · {formatDateTime(orden.creadaEn)}
      </p>

      {falla ? (
        <div
          className={`message message--${estado.variante} ventiladores-orden__falla`}
          role="alert"
        >
          <div>
            <strong>{estado.etiqueta}</strong>
            <p className="ventiladores-orden__detalle">{estado.descripcion}</p>

            {orden.error && (
              <p className="ventiladores-orden__detalle">
                Motivo: {orden.error}
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          <span className={`status status--${estado.variante}`}>
            {estado.etiqueta}
          </span>

          {estado.descripcion && (
            <p className="ventiladores-orden__detalle">{estado.descripcion}</p>
          )}
        </>
      )}
    </>
  );
};

const TarjetaVentilador = ({
  ventilador,
  numero,
  puedeControlar,
  puedeAutomatizar,
}) => {
  const { id } = ventilador;

  // Las órdenes se guardan junto al ventilador al que pertenecen: mientras
  // no coincida se considera "cargando" (sin resetear estado en el efecto).
  const [ordenes, setOrdenes] = useState({ id: null, ultima: null, error: "" });
  const [accionEnCurso, setAccionEnCurso] = useState("");
  const [errorAccion, setErrorAccion] = useState("");

  // Id de la última orden conocida al momento de enviar un comando, hasta que
  // la nueva orden aparezca en la suscripción (undefined = no se espera nada).
  const [ordenPrevia, setOrdenPrevia] = useState(undefined);

  useEffect(() => {
    const unsubscribe = ordenesRepository.suscribirseAOrdenesPorVentilador(
      id,
      (lista) => {
        setOrdenes({ id, ultima: lista[0] ?? null, error: "" });
      },
      (err) => {
        console.error("Error al leer las órdenes del ventilador:", err);
        setOrdenes({
          id,
          ultima: null,
          error: "No fue posible cargar las órdenes del ventilador.",
        });
      }
    );

    return unsubscribe;
  }, [id]);

  const cargandoOrdenes = ordenes.id !== id;
  const ultima = cargandoOrdenes ? null : ordenes.ultima;

  const { habilitado, motivo } = evaluarControl({
    modoControl: ventilador.modoControl,
    puedeControlar,
    ordenEnCurso: hayOrdenEnCurso({
      accionEnCurso,
      ordenPrevia,
      errorOrdenes: ordenes.error,
      ultima,
    }),
  });

  const handleComando = async (accion) => {
    if (!habilitado) return;

    const previa = ultima?.id ?? null;

    try {
      setAccionEnCurso(accion);
      setErrorAccion("");

      // La orden nueva llega a la pantalla por la suscripción en tiempo real.
      await ventiladoresRepository.enviarComando(id, accion);

      setOrdenPrevia(previa);
    } catch (err) {
      console.error("No fue posible enviar el comando:", err);
      setErrorAccion(mensajeDeErrorAlEnviar(err));
    } finally {
      setAccionEnCurso("");
    }
  };

  const estadoVentilador = obtenerEstadoVentilador(ventilador.estadoActual);

  return (
    <article className="card ventiladores-card">
      <header className="card__header">
        <div>
          <h2 className="card__title">Ventilador {numero}</h2>
          <p className="card__subtitle">ID: {formatShortId(id)}</p>
        </div>

        <span
          className={`ventiladores-estado-actual ventiladores-estado-actual--${estadoVentilador.clase}`}
        >
          {estadoVentilador.etiqueta}
        </span>
      </header>

      <dl className="ventiladores-datos">
        <div className="ventiladores-datos__fila">
          <dt>Modo de control</dt>
          <dd>{formatFanControlMode(ventilador.modoControl)}</dd>
        </div>
      </dl>

      <section className="ventiladores-orden" aria-label="Última orden">
        <h3 className="ventiladores-orden__titulo">Última orden</h3>

        <UltimaOrden
          cargando={cargandoOrdenes}
          error={ordenes.error}
          orden={ultima}
        />
      </section>

      {errorAccion && (
        <div className="message message--danger" role="alert">
          {errorAccion}
        </div>
      )}

      <div className="ventiladores-acciones">
        <button
          type="button"
          className="ventiladores-btn ventiladores-btn--encender"
          onClick={() => handleComando(FAN_ACTIONS.TURN_ON)}
          disabled={!habilitado}
        >
          {accionEnCurso === FAN_ACTIONS.TURN_ON ? "Enviando..." : "Encender"}
        </button>

        <button
          type="button"
          className="ventiladores-btn ventiladores-btn--apagar"
          onClick={() => handleComando(FAN_ACTIONS.TURN_OFF)}
          disabled={!habilitado}
        >
          {accionEnCurso === FAN_ACTIONS.TURN_OFF ? "Enviando..." : "Apagar"}
        </button>
      </div>

      {!habilitado && <p className="ventiladores-motivo">{motivo}</p>}

      {puedeAutomatizar && (
        <div className="card__footer">
          <Link
            to={ROUTES.AUTOMATION}
            state={{ incubadoraId: ventilador.incubadoraId, ventiladorId: id }}
            className="ventiladores-enlace"
          >
            Configurar modo y automatización
          </Link>
        </div>
      )}
    </article>
  );
};

const ControlVentiladores = () => {
  const { usuario } = useAuth();

  const [incubadoras, setIncubadoras] = useState([]);
  const [incubadoraId, setIncubadoraId] = useState("");
  const [loadingIncubadoras, setLoadingIncubadoras] = useState(true);
  const [errorIncubadoras, setErrorIncubadoras] = useState("");

  // Los ventiladores se guardan junto a la incubadora a la que pertenecen:
  // mientras no coincida con la elegida se considera "cargando".
  const [datos, setDatos] = useState({
    incubadoraId: null,
    ventiladores: [],
    error: "",
  });

  const puedeControlar = canControlFans(usuario);
  const puedeAutomatizar = canManageAutomation(usuario);

  // Incubadoras disponibles (no inactivas, igual que el panel general).
  useEffect(() => {
    let activo = true;

    const cargarIncubadoras = async () => {
      try {
        const lista = await incubadorasRepository.listarIncubadoras();

        if (!activo) return;

        const disponibles = lista.filter(
          (incubadora) => incubadora.estado !== INCUBATOR_STATUS.INACTIVE
        );

        setIncubadoras(disponibles);
        setIncubadoraId((actual) => actual || disponibles[0]?.id || "");
      } catch (err) {
        console.error("No fue posible cargar las incubadoras:", err);

        if (activo) {
          setErrorIncubadoras("No fue posible cargar las incubadoras.");
        }
      } finally {
        if (activo) {
          setLoadingIncubadoras(false);
        }
      }
    };

    cargarIncubadoras();

    return () => {
      activo = false;
    };
  }, []);

  // Ventiladores de la incubadora elegida, en tiempo real.
  useEffect(() => {
    if (!incubadoraId) {
      return undefined;
    }

    const unsubscribe =
      ventiladoresRepository.suscribirseAVentiladoresPorIncubadora(
        incubadoraId,
        (ventiladores) => {
          setDatos({ incubadoraId, ventiladores, error: "" });
        },
        (err) => {
          console.error("Error al leer los ventiladores:", err);
          setDatos({
            incubadoraId,
            ventiladores: [],
            error: "No fue posible cargar los ventiladores.",
          });
        }
      );

    return unsubscribe;
  }, [incubadoraId]);

  const cargandoVentiladores =
    incubadoraId !== "" && datos.incubadoraId !== incubadoraId;
  const ventiladores = cargandoVentiladores ? [] : datos.ventiladores;
  const errorVentiladores = cargandoVentiladores ? "" : datos.error;

  return (
    <section className="page ventiladores-page">
      <header className="page__header">
        <div className="page__header-content">
          <h1 className="page__title">Control de ventiladores</h1>
          <p className="page__subtitle">
            Consulte el estado de los ventiladores y, si su rol lo permite,
            enciéndalos o apáguelos manualmente.
          </p>
        </div>
      </header>

      {errorIncubadoras && (
        <div className="message message--danger ventiladores-mensaje" role="alert">
          {errorIncubadoras}
        </div>
      )}

      {loadingIncubadoras ? (
        <p className="ventiladores-estado">Cargando incubadoras...</p>
      ) : incubadoras.length === 0 ? (
        <div className="card empty-state">
          <p className="empty-state__title">No hay incubadoras disponibles</p>
          <p className="empty-state__description">
            Registre una incubadora activa para poder controlar sus
            ventiladores.
          </p>
        </div>
      ) : (
        <>
          <div className="form-group ventiladores-selector">
            <label className="form-label" htmlFor="ventiladores-incubadora">
              Incubadora
            </label>

            <select
              id="ventiladores-incubadora"
              className="input-base"
              value={incubadoraId}
              onChange={(event) => setIncubadoraId(event.target.value)}
            >
              {incubadoras.map((incubadora) => (
                <option key={incubadora.id} value={incubadora.id}>
                  {incubadora.nombre || incubadora.id}
                </option>
              ))}
            </select>
          </div>

          {errorVentiladores && (
            <div
              className="message message--danger ventiladores-mensaje"
              role="alert"
            >
              {errorVentiladores}
            </div>
          )}

          {cargandoVentiladores ? (
            <p className="ventiladores-estado">Cargando ventiladores...</p>
          ) : (
            !errorVentiladores &&
            (ventiladores.length === 0 ? (
              <div className="card empty-state">
                <p className="empty-state__title">
                  Sin ventiladores registrados
                </p>
                <p className="empty-state__description">
                  Esta incubadora no tiene ventiladores. Se crean al dar de
                  alta un dispositivo de tipo ventilador.
                </p>
              </div>
            ) : (
              <div className="ventiladores-grid">
                {ventiladores.map((ventilador, indice) => (
                  <TarjetaVentilador
                    key={ventilador.id}
                    ventilador={ventilador}
                    numero={indice + 1}
                    puedeControlar={puedeControlar}
                    puedeAutomatizar={puedeAutomatizar}
                  />
                ))}
              </div>
            ))
          )}
        </>
      )}
    </section>
  );
};

export default ControlVentiladores;
