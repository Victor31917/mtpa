import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import incubadorasRepository from "../../repositories/incubadorasRepository";
import reglasAutomatizacionRepository from "../../repositories/reglasAutomatizacionRepository";
import ventiladoresRepository from "../../repositories/ventiladoresRepository";
import {
  ENVIRONMENTAL_VARIABLES,
  FAN_CONTROL_MODE,
  FAN_CONTROL_MODE_LABELS,
  INCUBATOR_STATUS,
  MESSAGES,
  ROUTES,
  UNITS,
} from "../../utils/constants";
import { formatShortId } from "../../utils/formatters";
import "./AutomationRuleForm.css";

const MODOS = Object.values(FAN_CONTROL_MODE);

// Margen de histéresis mínimo que acepta la Cloud Function.
const MARGEN_MINIMO = 0.01;

// Campos cuya validez depende uno del otro (el margen debe ser menor que el
// umbral): al editar uno se revalida el otro.
const CAMPOS_RELACIONADOS = ["umbralActivacion", "margenHisteresis"];

const ERROR_AUTOMATICO_INACTIVO =
  "En modo automático la regla debe estar activa. Elija el modo Mixto si desea dejarla inactiva.";

const ERROR_UMBRAL_NO_POSITIVO =
  "El umbral de activación debe ser positivo y mayor que el margen.";

const DESCRIPCION_MODO = {
  [FAN_CONTROL_MODE.MANUAL]: "Solo se aceptan comandos manuales.",
  [FAN_CONTROL_MODE.AUTOMATIC]:
    "El ventilador se controla con la regla de automatización.",
  [FAN_CONTROL_MODE.MIXED]:
    "Admite comandos manuales y la regla de automatización.",
};

const VARIABLES = [
  {
    clave: ENVIRONMENTAL_VARIABLES.TEMPERATURE,
    titulo: "Temperatura",
    unidad: UNITS.TEMPERATURE,
  },
  {
    clave: ENVIRONMENTAL_VARIABLES.HUMIDITY,
    titulo: "Humedad",
    unidad: UNITS.HUMIDITY,
  },
];

// Los ventiladores nacen en modo manual y sin regla: ese es el punto de
// partida cuando no hay nada guardado.
const FORMULARIO_VACIO = {
  modoControl: FAN_CONTROL_MODE.MANUAL,
  variable: ENVIRONMENTAL_VARIABLES.TEMPERATURE,
  umbralActivacion: "",
  margenHisteresis: "",
  activa: true,
};

const aTexto = (valor) =>
  typeof valor === "number" && Number.isFinite(valor) ? String(valor) : "";

// Precarga el formulario con el modo del ventilador y, si existe, su regla.
const crearFormulario = (ventilador, regla) => ({
  modoControl: MODOS.includes(ventilador?.modoControl)
    ? ventilador.modoControl
    : FORMULARIO_VACIO.modoControl,
  variable: VARIABLES.some(({ clave }) => clave === regla?.variable)
    ? regla.variable
    : FORMULARIO_VACIO.variable,
  umbralActivacion: aTexto(regla?.umbralActivacion),
  margenHisteresis: aTexto(regla?.margenHisteresis),
  activa:
    typeof regla?.activa === "boolean" ? regla.activa : FORMULARIO_VACIO.activa,
});

const esNumeroFinito = (texto) =>
  texto.trim() !== "" && Number.isFinite(Number(texto));

// Devuelve los mensajes de error por campo, o un objeto vacío si el formulario
// es válido. En modo manual la regla no se aplica, así que no se valida.
const validar = (formulario) => {
  const errores = {};

  if (!MODOS.includes(formulario.modoControl)) {
    errores.modoControl = "Elija un modo de control.";
    return errores;
  }

  if (formulario.modoControl === FAN_CONTROL_MODE.MANUAL) {
    return errores;
  }

  if (!VARIABLES.some(({ clave }) => clave === formulario.variable)) {
    errores.variable = "Elija la variable que dispara la regla.";
  }

  const umbralValido = esNumeroFinito(formulario.umbralActivacion);
  const margenValido = esNumeroFinito(formulario.margenHisteresis);
  const umbral = Number(formulario.umbralActivacion);
  const margen = Number(formulario.margenHisteresis);

  if (!umbralValido) {
    errores.umbralActivacion = "Ingrese un umbral numérico.";
  } else if (umbral <= 0) {
    // Un umbral que no es positivo no admite ningún margen válido: se avisa en
    // el umbral, igual que la Cloud Function.
    errores.umbralActivacion = ERROR_UMBRAL_NO_POSITIVO;
  }

  if (!margenValido) {
    errores.margenHisteresis = "Ingrese un margen numérico.";
  } else if (margen <= 0) {
    errores.margenHisteresis = "El margen debe ser mayor que 0.";
  } else if (margen < MARGEN_MINIMO) {
    errores.margenHisteresis = "El margen mínimo es 0,01.";
  } else if (umbralValido && umbral > 0 && margen >= umbral) {
    errores.margenHisteresis = "El margen debe ser menor que el umbral.";
  }

  // En modo automático los comandos manuales se rechazan: con la regla
  // inactiva el ventilador quedaría sin ninguna forma de control.
  if (
    formulario.modoControl === FAN_CONTROL_MODE.AUTOMATIC &&
    !formulario.activa
  ) {
    errores.activa = ERROR_AUTOMATICO_INACTIVO;
  }

  return errores;
};

// Datos que recibe la callable "guardarReglaAutomatizacion". En modo manual
// solo se cambia el modo (la Cloud Function ignora el resto y conserva la regla
// guardada), así que no se envían los campos de la regla.
const armarDatos = (ventiladorId, formulario) => {
  if (formulario.modoControl === FAN_CONTROL_MODE.MANUAL) {
    return { ventiladorId, modoControl: formulario.modoControl };
  }

  return {
    ventiladorId,
    modoControl: formulario.modoControl,
    variable: formulario.variable,
    umbralActivacion: Number(formulario.umbralActivacion),
    margenHisteresis: Number(formulario.margenHisteresis),
    activa: formulario.activa,
  };
};

// Estado de edición después de cambiar un campo del formulario.
// - En modo manual la regla no se valida: no queda ningún error.
// - El aviso de "automático requiere regla activa" aparece apenas se da esa
//   combinación (al elegir el modo o al desmarcar la regla).
// - Umbral y margen se revalidan juntos: un error que ya se había mostrado se
//   actualiza (o desaparece) al corregir cualquiera de los dos, y el otro campo
//   se marca si ya tiene un valor que no cuadra con el que se acaba de editar.
const aplicarCambio = (previo, campo, valor) => {
  const formulario = { ...previo.formulario, [campo]: valor };

  if (formulario.modoControl === FAN_CONTROL_MODE.MANUAL) {
    return { ...previo, formulario, errores: {}, feedback: null };
  }

  const fresco = validar(formulario);
  const errores = { ...previo.errores, [campo]: undefined };

  if (campo === "modoControl" || campo === "activa") {
    errores.activa = fresco.activa;
  }

  if (campo === "modoControl" || CAMPOS_RELACIONADOS.includes(campo)) {
    for (const clave of CAMPOS_RELACIONADOS) {
      const yaMarcado = Boolean(previo.errores[clave]);
      const otroConValor = clave !== campo && formulario[clave].trim() !== "";

      errores[clave] = yaMarcado || otroConValor ? fresco[clave] : undefined;
    }
  }

  return { ...previo, formulario, errores, feedback: null };
};

// Mensaje legible para el error de la callable. Los errores de validación y de
// negocio traen un texto propio en español; el resto se traduce según el
// código para no mostrar el mensaje crudo de Firebase.
const mensajeDeErrorAlGuardar = (err) => {
  const codigo = String(err?.code ?? "").replace("functions/", "");

  if (codigo === "unauthenticated" || codigo === "permission-denied") {
    return "No tienes permisos para modificar la automatización de los ventiladores.";
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

  return "No fue posible guardar la regla. Inténtalo nuevamente.";
};

const AutomationRuleForm = () => {
  // Desde el panel de control se llega con la incubadora y el ventilador ya
  // elegidos (state del enlace); si se entra por URL se elige acá.
  const { state: destino } = useLocation();

  const [incubadoras, setIncubadoras] = useState([]);
  const [loadingIncubadoras, setLoadingIncubadoras] = useState(true);
  const [errorIncubadoras, setErrorIncubadoras] = useState("");

  const [incubadoraElegida, setIncubadoraElegida] = useState(
    destino?.incubadoraId ?? ""
  );
  const [ventiladorElegido, setVentiladorElegido] = useState(
    destino?.ventiladorId ?? ""
  );

  // Los ventiladores se guardan junto a la incubadora a la que pertenecen:
  // mientras no coincida con la elegida se considera "cargando".
  const [datos, setDatos] = useState({
    incubadoraId: null,
    ventiladores: [],
    error: "",
  });

  // Último listado recibido: sirve para precargar el modo del ventilador sin
  // volver a leer la regla cada vez que la suscripción trae un cambio.
  const ventiladoresRef = useRef([]);

  // Formulario del ventilador cargado; "ventiladorId" indica a cuál pertenece.
  const [edicion, setEdicion] = useState({
    ventiladorId: null,
    formulario: FORMULARIO_VACIO,
    errorCarga: "",
    errores: {},
    feedback: null,
  });
  const [guardando, setGuardando] = useState(false);

  // Incubadora y ventilador efectivos: lo elegido si existe, si no el primero.
  const incubadoraId = incubadoras.some(({ id }) => id === incubadoraElegida)
    ? incubadoraElegida
    : incubadoras[0]?.id ?? "";

  const cargandoVentiladores =
    incubadoraId !== "" && datos.incubadoraId !== incubadoraId;
  const ventiladores = cargandoVentiladores ? [] : datos.ventiladores;
  const errorVentiladores = cargandoVentiladores ? "" : datos.error;

  const ventiladorId = ventiladores.some(({ id }) => id === ventiladorElegido)
    ? ventiladorElegido
    : ventiladores[0]?.id ?? "";

  // Incubadoras disponibles (no inactivas, igual que el panel general).
  useEffect(() => {
    let activo = true;

    const cargarIncubadoras = async () => {
      try {
        const lista = await incubadorasRepository.listarIncubadoras();

        if (!activo) return;

        setIncubadoras(
          lista.filter(
            (incubadora) => incubadora.estado !== INCUBATOR_STATUS.INACTIVE
          )
        );
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
        (lista) => {
          ventiladoresRef.current = lista;
          setDatos({ incubadoraId, ventiladores: lista, error: "" });
        },
        (err) => {
          console.error("Error al leer los ventiladores:", err);
          ventiladoresRef.current = [];
          setDatos({
            incubadoraId,
            ventiladores: [],
            error: "No fue posible cargar los ventiladores.",
          });
        }
      );

    return unsubscribe;
  }, [incubadoraId]);

  // Regla vigente del ventilador elegido: se lee una sola vez para precargar
  // el formulario (una suscripción en vivo pisaría lo que se está escribiendo).
  useEffect(() => {
    if (!ventiladorId) {
      return undefined;
    }

    let activo = true;

    const cargarRegla = async () => {
      const ventilador = ventiladoresRef.current.find(
        ({ id }) => id === ventiladorId
      );

      try {
        const regla =
          await reglasAutomatizacionRepository.obtenerReglaPorVentiladorId(
            ventiladorId
          );

        if (activo) {
          setEdicion({
            ventiladorId,
            formulario: crearFormulario(ventilador, regla),
            errorCarga: "",
            errores: {},
            feedback: null,
          });
        }
      } catch (err) {
        console.error("No fue posible cargar la regla:", err);

        if (activo) {
          setEdicion({
            ventiladorId,
            formulario: crearFormulario(ventilador, null),
            errorCarga: "No fue posible cargar la regla configurada.",
            errores: {},
            feedback: null,
          });
        }
      }
    };

    cargarRegla();

    return () => {
      activo = false;
    };
  }, [ventiladorId]);

  const cargandoRegla =
    ventiladorId !== "" && edicion.ventiladorId !== ventiladorId;
  const formulario = edicion.formulario;
  const manual = formulario.modoControl === FAN_CONTROL_MODE.MANUAL;
  const variableElegida = VARIABLES.find(
    ({ clave }) => clave === formulario.variable
  );

  const handleCambiarIncubadora = (event) => {
    setIncubadoraElegida(event.target.value);
    setVentiladorElegido("");
  };

  const handleChange = (campo, valor) => {
    setEdicion((previo) => aplicarCambio(previo, campo, valor));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (guardando) return;

    const errores = validar(formulario);

    if (Object.keys(errores).length > 0) {
      setEdicion((previo) => ({ ...previo, errores, feedback: null }));
      return;
    }

    try {
      setGuardando(true);
      setEdicion((previo) => ({ ...previo, errores: {}, feedback: null }));

      await reglasAutomatizacionRepository.guardarRegla(
        armarDatos(ventiladorId, formulario)
      );

      setEdicion((previo) => ({
        ...previo,
        feedback: {
          tipo: "success",
          texto: "La configuración del ventilador se guardó correctamente.",
        },
      }));
    } catch (err) {
      console.error("No fue posible guardar la regla:", err);

      setEdicion((previo) => ({
        ...previo,
        feedback: { tipo: "danger", texto: mensajeDeErrorAlGuardar(err) },
      }));
    } finally {
      setGuardando(false);
    }
  };

  const errores = edicion.errores;

  return (
    <section className="page automatizacion-page">
      <Link to={ROUTES.FANS} className="automatizacion__volver">
        ← Volver al panel de ventiladores
      </Link>

      <header className="page__header">
        <div className="page__header-content">
          <h1 className="page__title">Automatización de ventiladores</h1>
          <p className="page__subtitle">
            Defina cómo se controla cada ventilador y, si corresponde, la regla
            que lo enciende y apaga según la temperatura o la humedad.
          </p>
        </div>
      </header>

      {errorIncubadoras && (
        <div className="message message--danger automatizacion-mensaje" role="alert">
          {errorIncubadoras}
        </div>
      )}

      {loadingIncubadoras ? (
        <p className="automatizacion-estado">Cargando incubadoras...</p>
      ) : incubadoras.length === 0 ? (
        // Si la carga falló solo se muestra el error, no "no hay incubadoras".
        !errorIncubadoras && (
          <div className="card empty-state">
            <p className="empty-state__title">No hay incubadoras disponibles</p>
            <p className="empty-state__description">
              Registre una incubadora activa para poder configurar sus
              ventiladores.
            </p>
          </div>
        )
      ) : (
        <>
          <div className="automatizacion-selectores">
            <div className="form-group">
              <label className="form-label" htmlFor="automatizacion-incubadora">
                Incubadora
              </label>

              <select
                id="automatizacion-incubadora"
                className="input-base"
                value={incubadoraId}
                onChange={handleCambiarIncubadora}
                disabled={guardando}
              >
                {incubadoras.map((incubadora) => (
                  <option key={incubadora.id} value={incubadora.id}>
                    {incubadora.nombre || incubadora.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="automatizacion-ventilador">
                Ventilador
              </label>

              <select
                id="automatizacion-ventilador"
                className="input-base"
                value={ventiladorId}
                onChange={(event) => setVentiladorElegido(event.target.value)}
                disabled={guardando || ventiladores.length === 0}
              >
                {ventiladores.map((ventilador) => (
                  <option key={ventilador.id} value={ventilador.id}>
                    Ventilador{" "}
                    {formatShortId(ventilador.dispositivoId || ventilador.id)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {errorVentiladores && (
            <div
              className="message message--danger automatizacion-mensaje"
              role="alert"
            >
              {errorVentiladores}
            </div>
          )}

          {cargandoVentiladores ? (
            <p className="automatizacion-estado">Cargando ventiladores...</p>
          ) : ventiladores.length === 0 ? (
            !errorVentiladores && (
              <div className="card empty-state">
                <p className="empty-state__title">
                  Sin ventiladores registrados
                </p>
                <p className="empty-state__description">
                  Esta incubadora no tiene ventiladores. Se crean al dar de alta
                  un dispositivo de tipo ventilador.
                </p>
              </div>
            )
          ) : cargandoRegla ? (
            <p className="automatizacion-estado">Cargando configuración...</p>
          ) : (
            <form
              className="card automatizacion-card"
              onSubmit={handleSubmit}
              noValidate
            >
              {edicion.errorCarga && (
                <div
                  className="message message--danger automatizacion-mensaje"
                  role="alert"
                >
                  {edicion.errorCarga}
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="automatizacion-modo">
                  Modo de control
                </label>

                <select
                  id="automatizacion-modo"
                  className="input-base"
                  value={formulario.modoControl}
                  onChange={(event) =>
                    handleChange("modoControl", event.target.value)
                  }
                  aria-invalid={Boolean(errores.modoControl)}
                  aria-describedby={
                    errores.modoControl ? "automatizacion-modo-error" : undefined
                  }
                  disabled={guardando}
                >
                  {MODOS.map((modo) => (
                    <option key={modo} value={modo}>
                      {FAN_CONTROL_MODE_LABELS[modo]}
                    </option>
                  ))}
                </select>

                {errores.modoControl ? (
                  <span id="automatizacion-modo-error" className="form-error">
                    {errores.modoControl}
                  </span>
                ) : (
                  <span className="form-helper">
                    {DESCRIPCION_MODO[formulario.modoControl]}
                  </span>
                )}
              </div>

              {formulario.modoControl === FAN_CONTROL_MODE.AUTOMATIC && (
                <div
                  className="message message--warning automatizacion-mensaje"
                  role="status"
                >
                  En modo automático los comandos manuales de este ventilador se
                  rechazarán.
                </div>
              )}

              <fieldset className="automatizacion-regla" disabled={guardando || manual}>
                <legend className="automatizacion-regla__titulo">
                  Regla de automatización
                </legend>

                {manual && (
                  <p className="automatizacion-regla__nota">
                    En modo manual la regla no se aplica y la guardada se
                    conserva sin cambios. Elija el modo automático o mixto
                    para configurarla.
                  </p>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="automatizacion-variable">
                    Variable
                  </label>

                  <select
                    id="automatizacion-variable"
                    className="input-base"
                    value={formulario.variable}
                    onChange={(event) =>
                      handleChange("variable", event.target.value)
                    }
                    aria-invalid={Boolean(errores.variable)}
                    aria-describedby={
                      errores.variable ? "automatizacion-variable-error" : undefined
                    }
                  >
                    {VARIABLES.map(({ clave, titulo }) => (
                      <option key={clave} value={clave}>
                        {titulo}
                      </option>
                    ))}
                  </select>

                  {errores.variable && (
                    <span id="automatizacion-variable-error" className="form-error">
                      {errores.variable}
                    </span>
                  )}
                </div>

                <div className="automatizacion-campos">
                  <div className="form-group">
                    <label className="form-label" htmlFor="automatizacion-umbral">
                      Umbral de activación ({variableElegida?.unidad})
                    </label>

                    <input
                      id="automatizacion-umbral"
                      className="input-base"
                      type="number"
                      step="0.1"
                      inputMode="decimal"
                      value={formulario.umbralActivacion}
                      onChange={(event) =>
                        handleChange("umbralActivacion", event.target.value)
                      }
                      aria-invalid={Boolean(errores.umbralActivacion)}
                      aria-describedby={
                        errores.umbralActivacion
                          ? "automatizacion-umbral-error"
                          : undefined
                      }
                    />

                    {errores.umbralActivacion && (
                      <span
                        id="automatizacion-umbral-error"
                        className="form-error"
                      >
                        {errores.umbralActivacion}
                      </span>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="automatizacion-margen">
                      Margen de histéresis ({variableElegida?.unidad})
                    </label>

                    <input
                      id="automatizacion-margen"
                      className="input-base"
                      type="number"
                      step="0.1"
                      inputMode="decimal"
                      value={formulario.margenHisteresis}
                      onChange={(event) =>
                        handleChange("margenHisteresis", event.target.value)
                      }
                      aria-invalid={Boolean(errores.margenHisteresis)}
                      aria-describedby={
                        errores.margenHisteresis
                          ? "automatizacion-margen-error"
                          : undefined
                      }
                    />

                    {errores.margenHisteresis ? (
                      <span
                        id="automatizacion-margen-error"
                        className="form-error"
                      >
                        {errores.margenHisteresis}
                      </span>
                    ) : (
                      <span className="form-helper">
                        Debe ser al menos 0,01 y menor que el umbral.
                      </span>
                    )}
                  </div>
                </div>

                <label className="automatizacion-activa">
                  <input
                    type="checkbox"
                    checked={formulario.activa}
                    onChange={(event) =>
                      handleChange("activa", event.target.checked)
                    }
                    aria-invalid={Boolean(errores.activa)}
                    aria-describedby={
                      errores.activa ? "automatizacion-activa-error" : undefined
                    }
                  />
                  Regla activa
                </label>

                {errores.activa && (
                  <span
                    id="automatizacion-activa-error"
                    className="form-error"
                  >
                    {errores.activa}
                  </span>
                )}

                {formulario.modoControl === FAN_CONTROL_MODE.MIXED &&
                  !formulario.activa && (
                    <div
                      className="message message--info automatizacion-aviso"
                      role="status"
                    >
                      Con la regla inactiva, el ventilador solo responderá a
                      los comandos manuales.
                    </div>
                  )}
              </fieldset>

              {edicion.feedback && (
                <div
                  className={`message message--${edicion.feedback.tipo} automatizacion-mensaje`}
                  role={edicion.feedback.tipo === "danger" ? "alert" : "status"}
                >
                  {edicion.feedback.texto}
                </div>
              )}

              <div className="card__footer">
                <button
                  type="submit"
                  className="automatizacion-btn-guardar"
                  disabled={guardando}
                >
                  {guardando ? MESSAGES.SAVING : "Guardar"}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
};

export default AutomationRuleForm;
