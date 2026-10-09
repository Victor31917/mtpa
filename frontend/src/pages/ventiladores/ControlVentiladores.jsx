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
import { formatDateTime, toDate } from "../../utils/dateUtils";
import {
  formatFanControlMode,
  formatFanStatus,
  formatShortId,
} from "../../utils/formatters";
import { canControlFans, canManageAutomation } from "../../utils/permissions";
import "./ControlVentiladores.css";

// Tiempo máximo que una orden "en curso" bloquea los botones. Una orden sana
// termina antes: se descarta a los 60 s si no salió, y una vez enviada se
// espera la confirmación hasta 30 s más. Se agrega un margen. Pasado este
// tiempo la orden se muestra como atascada y se vuelve a permitir enviar.
const ORDEN_EN_CURSO_MAX_MS = 120 * 1000;

// Órdenes más recientes que se leen por ventilador (solo hace falta la
// última; unas pocas más permiten reconocer la que se acaba de crear).
const ORDENES_LEIDAS = 5;

// Cada cuánto se actualiza el reloj mientras haya una orden en curso, para
// rehabilitar los botones cuando una orden pasa a atascada.
const INTERVALO_RELOJ_MS = 5 * 1000;

// Texto y variante visual de cada estado de una orden (COMMAND_STATUS).
// La variante es una de las de global.css (.status--*, .message--*).
const ESTADOS_ORDEN = {
  [COMMAND_STATUS.PENDING]: {
    etiqueta: "Pendiente",
    variante: "info",
    descripcion: "En cola, esperando su envío al ventilador.",
  },
  [COMMAND_STATUS.SENDING]: {
    etiqueta: "Enviando",
    variante: "info",
    descripcion: "Enviando la orden al ventilador.",
  },
  [COMMAND_STATUS.SENT]: {
    etiqueta: "Enviada",
    variante: "info",
    descripcion: "Orden enviada; esperando la confirmación del ventilador.",
  },
  [COMMAND_STATUS.EXECUTED]: {
    etiqueta: "Ejecutada",
    variante: "success",
    descripcion: "El ventilador confirmó el cambio.",
  },
  [COMMAND_STATUS.FAILED]: {
    etiqueta: "Fallida",
    variante: "danger",
    descripcion: "La orden no pudo completarse. Inténtelo nuevamente.",
  },
  [COMMAND_STATUS.EXPIRED]: {
    etiqueta: "Expirada",
    variante: "warning",
    descripcion:
      "La orden no se envió a tiempo y se descartó. Inténtelo nuevamente.",
  },
};

const ESTADO_ORDEN_DESCONOCIDO = {
  etiqueta: "Desconocido",
  variante: "muted",
  descripcion: "",
};

// Una orden que lleva demasiado tiempo en curso (ORDEN_EN_CURSO_MAX_MS) se
// presenta aparte de las demás, en variante de advertencia.
const ESTADO_ORDEN_ATASCADA = {
  etiqueta: "Atascada",
  variante: "warning",
  descripcion:
    "La orden sigue sin confirmarse. Verifique el ventilador antes de volver a intentarlo.",
};

// Una orden en estos estados todavía no terminó: mientras sea reciente no se
// admite otro comando.
const ESTADOS_ORDEN_EN_CURSO = [
  COMMAND_STATUS.PENDING,
  COMMAND_STATUS.SENDING,
  COMMAND_STATUS.SENT,
];

// Estados terminales con error: se muestran en un bloque aparte para que no
// se confundan con una orden que sigue su curso.
const ESTADOS_ORDEN_FALLIDOS = [COMMAND_STATUS.FAILED, COMMAND_STATUS.EXPIRED];

const ETIQUETAS_ACCION = {
  [FAN_ACTIONS.TURN_ON]: "Encender",
  [FAN_ACTIONS.TURN_OFF]: "Apagar",
};

const obtenerEstadoOrden = (estado) =>
  ESTADOS_ORDEN[estado] ?? ESTADO_ORDEN_DESCONOCIDO;

// Milisegundos desde que se creó la orden. Sin "creadaEn" (por ejemplo, el
// server timestamp todavía pendiente) se la considera recién creada.
const edadDeOrden = (orden, ahora) => {
  const creada = toDate(orden?.creadaEn);

  return creada ? ahora - creada.getTime() : 0;
};

// Orden en curso que superó el tiempo máximo sin terminar.
const estaAtascada = (orden, ahora) =>
  ESTADOS_ORDEN_EN_CURSO.includes(orden?.estado) &&
  edadDeOrden(orden, ahora) >= ORDEN_EN_CURSO_MAX_MS;

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
// ("ordenEsperada") todavía no llegó por la suscripción, o la última orden aún
// no terminó y es reciente.
const hayOrdenEnCurso = ({
  accionEnCurso,
  ordenEsperada,
  ordenes,
  ultima,
  ahora,
}) => {
  if (accionEnCurso !== "") {
    return true;
  }

  if (
    ordenEsperada &&
    !ordenes.some((orden) => orden.id === ordenEsperada.id) &&
    ahora - ordenEsperada.desde < ORDEN_EN_CURSO_MAX_MS
  ) {
    return true;
  }

  return (
    ESTADOS_ORDEN_EN_CURSO.includes(ultima?.estado) &&
    !estaAtascada(ultima, ahora)
  );
};

// Decide si los botones de encender/apagar están habilitados y, si no, por
// qué. Los comandos manuales solo se admiten en modo manual o mixto (igual
// que la Cloud Function) y solo a quien tiene permiso de control. Mientras no
// se sepa cuál es la última orden (cargando o con error) no se permite enviar.
const evaluarControl = ({
  modoControl,
  puedeControlar,
  cargandoOrdenes,
  errorOrdenes,
  ordenEnCurso,
}) => {
  if (!puedeControlar) {
    return {
      habilitado: false,
      motivo: "Su rol no permite enviar comandos a los ventiladores.",
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

  if (errorOrdenes) {
    return {
      habilitado: false,
      motivo:
        "No se pudieron consultar las órdenes de este ventilador, por eso no se pueden enviar comandos. Recargue la página para reintentar.",
    };
  }

  if (cargandoOrdenes) {
    return {
      habilitado: false,
      motivo: "Consultando las órdenes del ventilador...",
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

const UltimaOrden = ({ cargando, error, orden, ahora }) => {
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

  const atascada = estaAtascada(orden, ahora);
  const estado = atascada
    ? ESTADO_ORDEN_ATASCADA
    : obtenerEstadoOrden(orden.estado);
  const aparte = atascada || ESTADOS_ORDEN_FALLIDOS.includes(orden.estado);
  const accion = ETIQUETAS_ACCION[orden.accionSolicitada] ?? "-";

  return (
    <>
      <p className="ventiladores-orden__texto">
        {accion} · {formatDateTime(orden.creadaEn)}
      </p>

      {aparte ? (
        // El detalle técnico de la orden (si lo hay) queda solo en el title.
        <div
          className={`message message--${estado.variante} ventiladores-orden__falla`}
          role="alert"
          title={orden.error || undefined}
        >
          <div>
            <strong>{estado.etiqueta}</strong>
            <p className="ventiladores-orden__detalle">{estado.descripcion}</p>
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
  puedeControlar,
  puedeAutomatizar,
}) => {
  const { id } = ventilador;

  // El ventilador se identifica por su dispositivo, no por su posición en el
  // listado (que cambia si se agregan o quitan ventiladores).
  const nombre = `Ventilador ${formatShortId(ventilador.dispositivoId || id)}`;

  // Las órdenes se guardan junto al ventilador al que pertenecen: mientras
  // no coincida se considera "cargando" (sin resetear estado en el efecto).
  const [ordenes, setOrdenes] = useState({ id: null, lista: [], error: "" });
  const [accionEnCurso, setAccionEnCurso] = useState("");
  const [errorAccion, setErrorAccion] = useState("");

  // Orden recién creada por esta pantalla ({ id, desde }) hasta que aparezca
  // en la suscripción.
  const [ordenEsperada, setOrdenEsperada] = useState(null);

  // Reloj para decidir cuándo una orden en curso pasa a atascada.
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const unsubscribe = ordenesRepository.suscribirseAOrdenesPorVentilador(
      id,
      (lista) => {
        setAhora(Date.now());
        setOrdenes({ id, lista, error: "" });
      },
      (err) => {
        console.error("Error al leer las órdenes del ventilador:", err);
        setOrdenes({
          id,
          lista: [],
          error: "No fue posible cargar las órdenes del ventilador.",
        });
      },
      ORDENES_LEIDAS
    );

    return unsubscribe;
  }, [id]);

  const cargandoOrdenes = ordenes.id !== id;
  const lista = cargandoOrdenes ? [] : ordenes.lista;
  const ultima = lista[0] ?? null;

  const necesitaReloj =
    ordenEsperada !== null || ESTADOS_ORDEN_EN_CURSO.includes(ultima?.estado);

  useEffect(() => {
    if (!necesitaReloj) {
      return undefined;
    }

    const intervalo = setInterval(
      () => setAhora(Date.now()),
      INTERVALO_RELOJ_MS
    );

    return () => clearInterval(intervalo);
  }, [necesitaReloj]);

  const { habilitado, motivo } = evaluarControl({
    modoControl: ventilador.modoControl,
    puedeControlar,
    cargandoOrdenes,
    errorOrdenes: cargandoOrdenes ? "" : ordenes.error,
    ordenEnCurso: hayOrdenEnCurso({
      accionEnCurso,
      ordenEsperada,
      ordenes: lista,
      ultima,
      ahora,
    }),
  });

  const idMotivo = `ventilador-${id}-motivo`;

  const handleComando = async (accion) => {
    if (!habilitado) return;

    try {
      setAccionEnCurso(accion);
      setErrorAccion("");

      // La orden nueva llega a la pantalla por la suscripción en tiempo real.
      const resultado = await ventiladoresRepository.enviarComando(id, accion);

      const instante = Date.now();

      setAhora(instante);

      if (resultado?.ordenId) {
        setOrdenEsperada({ id: resultado.ordenId, desde: instante });
      }
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
        <h2 className="card__title">{nombre}</h2>

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
          error={cargandoOrdenes ? "" : ordenes.error}
          orden={ultima}
          ahora={ahora}
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
          aria-label={`Encender ${nombre.toLowerCase()}`}
          aria-describedby={habilitado ? undefined : idMotivo}
        >
          {accionEnCurso === FAN_ACTIONS.TURN_ON ? "Enviando..." : "Encender"}
        </button>

        <button
          type="button"
          className="ventiladores-btn ventiladores-btn--apagar"
          onClick={() => handleComando(FAN_ACTIONS.TURN_OFF)}
          disabled={!habilitado}
          aria-label={`Apagar ${nombre.toLowerCase()}`}
          aria-describedby={habilitado ? undefined : idMotivo}
        >
          {accionEnCurso === FAN_ACTIONS.TURN_OFF ? "Enviando..." : "Apagar"}
        </button>
      </div>

      {!habilitado && (
        <p id={idMotivo} className="ventiladores-motivo">
          {motivo}
        </p>
      )}

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
        // Si la carga falló solo se muestra el error, no "no hay incubadoras".
        !errorIncubadoras && (
          <div className="card empty-state">
            <p className="empty-state__title">No hay incubadoras disponibles</p>
            <p className="empty-state__description">
              Registre una incubadora activa para poder controlar sus
              ventiladores.
            </p>
          </div>
        )
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
                {ventiladores.map((ventilador) => (
                  <TarjetaVentilador
                    key={ventilador.id}
                    ventilador={ventilador}
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
