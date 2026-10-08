import { useEffect, useState } from "react";
import incubadorasRepository from "../../repositories/incubadorasRepository";
import umbralesRepository from "../../repositories/umbralesRepository";
import {
  ENVIRONMENTAL_VARIABLES,
  INCUBATOR_STATUS,
  MESSAGES,
  REFERENCE_RANGES,
  UNITS,
} from "../../utils/constants";
import "./ConfiguracionLimites.css";

// Variables configurables. Los límites de referencia solo se muestran
// como ayuda: los valores reales son los guardados en "umbrales".
const VARIABLES = [
  {
    clave: ENVIRONMENTAL_VARIABLES.TEMPERATURE,
    titulo: "Temperatura",
    unidad: UNITS.TEMPERATURE,
    referencia: REFERENCE_RANGES.TEMPERATURE,
  },
  {
    clave: ENVIRONMENTAL_VARIABLES.HUMIDITY,
    titulo: "Humedad",
    unidad: UNITS.HUMIDITY,
    referencia: REFERENCE_RANGES.HUMIDITY,
  },
];

const crearFormularioVacio = () =>
  Object.fromEntries(
    VARIABLES.map(({ clave }) => [clave, { minimo: "", maximo: "" }])
  );

const crearFormulario = (umbrales) =>
  Object.fromEntries(
    VARIABLES.map(({ clave }) => [
      clave,
      {
        minimo: umbrales?.[clave] ? String(umbrales[clave].minimo) : "",
        maximo: umbrales?.[clave] ? String(umbrales[clave].maximo) : "",
      },
    ])
  );

// Devuelve { minimo?, maximo?, general? } con los mensajes de error, o un
// objeto vacío si los valores son válidos.
const validar = (clave, valores) => {
  const errores = {};

  const minimo = Number(valores.minimo);
  const maximo = Number(valores.maximo);

  if (valores.minimo.trim() === "" || !Number.isFinite(minimo)) {
    errores.minimo = "Ingrese un mínimo numérico.";
  }

  if (valores.maximo.trim() === "" || !Number.isFinite(maximo)) {
    errores.maximo = "Ingrese un máximo numérico.";
  }

  if (Object.keys(errores).length > 0) {
    return errores;
  }

  if (minimo >= maximo) {
    errores.general = "El mínimo debe ser menor que el máximo.";
    return errores;
  }

  if (
    clave === ENVIRONMENTAL_VARIABLES.HUMIDITY &&
    (minimo < 0 || maximo > 100)
  ) {
    errores.general = "La humedad debe estar entre 0 y 100 %.";
  }

  return errores;
};

// Nunca se muestra el mensaje crudo de Firebase: se traduce a un texto
// propio según el código del error.
const mensajeDeErrorAlGuardar = (err) => {
  if (err?.code === umbralesRepository.UMBRAL_INVALIDO) {
    return err.message;
  }

  if (
    err?.code === "permission-denied" ||
    err?.code === "unauthenticated"
  ) {
    return "No tienes permisos para modificar los límites.";
  }

  if (err?.code === "unavailable") {
    return MESSAGES.CONNECTION_ERROR;
  }

  return "No fue posible guardar los límites. Inténtalo nuevamente.";
};

const ConfiguracionLimites = () => {
  const [incubadoras, setIncubadoras] = useState([]);
  const [incubadoraId, setIncubadoraId] = useState("");
  const [loadingIncubadoras, setLoadingIncubadoras] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");

  const [formulario, setFormulario] = useState(crearFormularioVacio);
  const [loadingUmbrales, setLoadingUmbrales] = useState(false);

  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState("");
  const [feedback, setFeedback] = useState(null);

  // Incubadoras disponibles (no inactivas, igual que el panel general).
  useEffect(() => {
    let activo = true;

    const cargarIncubadoras = async () => {
      try {
        const datos = await incubadorasRepository.listarIncubadoras();

        if (!activo) return;

        const disponibles = datos.filter(
          (incubadora) => incubadora.estado !== INCUBATOR_STATUS.INACTIVE
        );

        setIncubadoras(disponibles);
        setIncubadoraId((actual) => actual || disponibles[0]?.id || "");
      } catch (err) {
        console.error("No fue posible cargar las incubadoras:", err);

        if (activo) {
          setErrorCarga("No fue posible cargar las incubadoras.");
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

  // Umbrales vigentes de la incubadora elegida: se leen una sola vez para
  // precargar el formulario (una suscripción en vivo pisaría lo que el
  // administrador está escribiendo).
  useEffect(() => {
    if (!incubadoraId) {
      return undefined;
    }

    let activo = true;

    const cargarUmbrales = async () => {
      try {
        setLoadingUmbrales(true);
        setErrorCarga("");

        const umbrales =
          await umbralesRepository.obtenerUmbralesPorIncubadora(incubadoraId);

        if (activo) {
          setFormulario(crearFormulario(umbrales));
        }
      } catch (err) {
        console.error("No fue posible cargar los umbrales:", err);

        if (activo) {
          setErrorCarga("No fue posible cargar los límites configurados.");
        }
      } finally {
        if (activo) {
          setLoadingUmbrales(false);
        }
      }
    };

    cargarUmbrales();

    return () => {
      activo = false;
    };
  }, [incubadoraId]);

  const handleCambiarIncubadora = (event) => {
    setFormulario(crearFormularioVacio());
    setErrores({});
    setFeedback(null);
    setIncubadoraId(event.target.value);
  };

  const handleChange = (clave, campo, valor) => {
    setFormulario((previo) => ({
      ...previo,
      [clave]: { ...previo[clave], [campo]: valor },
    }));

    setErrores((previo) => ({ ...previo, [clave]: undefined }));
    setFeedback(null);
  };

  const handleSubmit = async (event, variable) => {
    event.preventDefault();

    const { clave, titulo } = variable;
    const erroresVariable = validar(clave, formulario[clave]);

    if (Object.keys(erroresVariable).length > 0) {
      setErrores((previo) => ({ ...previo, [clave]: erroresVariable }));
      setFeedback(null);
      return;
    }

    try {
      setGuardando(clave);
      setFeedback(null);

      const guardado = await umbralesRepository.guardarUmbral({
        incubadoraId,
        variable: clave,
        minimo: formulario[clave].minimo,
        maximo: formulario[clave].maximo,
      });

      setFormulario((previo) => ({
        ...previo,
        [clave]: {
          minimo: String(guardado.minimo),
          maximo: String(guardado.maximo),
        },
      }));

      setFeedback({
        clave,
        tipo: "success",
        texto: `Los límites de ${titulo.toLowerCase()} se guardaron correctamente.`,
      });
    } catch (err) {
      console.error("No fue posible guardar el umbral:", err);

      setFeedback({
        clave,
        tipo: "danger",
        texto: mensajeDeErrorAlGuardar(err),
      });
    } finally {
      setGuardando("");
    }
  };

  const ocupado = loadingUmbrales || guardando !== "";

  return (
    <section className="page limites-page">
      <header className="page__header">
        <div className="page__header-content">
          <h1 className="page__title">Límites de monitoreo</h1>
          <p className="page__subtitle">
            Defina el mínimo y el máximo aceptables de cada variable. Cuando una
            medición los supere se genera una alerta.
          </p>
        </div>
      </header>

      {errorCarga && (
        <div className="message message--danger limites-mensaje" role="alert">
          {errorCarga}
        </div>
      )}

      {loadingIncubadoras ? (
        <p className="limites-estado">Cargando incubadoras...</p>
      ) : incubadoras.length === 0 ? (
        <div className="card empty-state">
          <p className="empty-state__title">No hay incubadoras disponibles</p>
          <p className="empty-state__description">
            Registre una incubadora activa para poder configurar sus límites.
          </p>
        </div>
      ) : (
        <>
          <div className="form-group limites-selector">
            <label className="form-label" htmlFor="limites-incubadora">
              Incubadora
            </label>

            <select
              id="limites-incubadora"
              className="input-base"
              value={incubadoraId}
              onChange={handleCambiarIncubadora}
              disabled={ocupado}
            >
              {incubadoras.map((incubadora) => (
                <option key={incubadora.id} value={incubadora.id}>
                  {incubadora.nombre || incubadora.id}
                </option>
              ))}
            </select>
          </div>

          {loadingUmbrales ? (
            <p className="limites-estado">Cargando límites...</p>
          ) : (
            <div className="grid grid--2">
              {VARIABLES.map((variable) => {
                const { clave, titulo, unidad, referencia } = variable;
                const erroresVariable = errores[clave] ?? {};
                const feedbackVariable =
                  feedback?.clave === clave ? feedback : null;
                const guardandoEsta = guardando === clave;

                return (
                  <form
                    key={clave}
                    className="card limites-card"
                    onSubmit={(event) => handleSubmit(event, variable)}
                    noValidate
                  >
                    <div className="card__header">
                      <div>
                        <h2 className="card__title">
                          {titulo} ({unidad})
                        </h2>
                        <p className="card__subtitle">
                          Referencia: {referencia.MIN} a {referencia.MAX}{" "}
                          {referencia.UNIT}
                        </p>
                      </div>
                    </div>

                    <div className="limites-campos">
                      <div className="form-group">
                        <label
                          className="form-label"
                          htmlFor={`limites-${clave}-minimo`}
                        >
                          Mínimo ({unidad})
                        </label>

                        <input
                          id={`limites-${clave}-minimo`}
                          className="input-base"
                          type="number"
                          step="0.1"
                          inputMode="decimal"
                          value={formulario[clave].minimo}
                          onChange={(event) =>
                            handleChange(clave, "minimo", event.target.value)
                          }
                          aria-invalid={Boolean(erroresVariable.minimo)}
                          disabled={ocupado}
                        />

                        {erroresVariable.minimo && (
                          <span className="form-error">
                            {erroresVariable.minimo}
                          </span>
                        )}
                      </div>

                      <div className="form-group">
                        <label
                          className="form-label"
                          htmlFor={`limites-${clave}-maximo`}
                        >
                          Máximo ({unidad})
                        </label>

                        <input
                          id={`limites-${clave}-maximo`}
                          className="input-base"
                          type="number"
                          step="0.1"
                          inputMode="decimal"
                          value={formulario[clave].maximo}
                          onChange={(event) =>
                            handleChange(clave, "maximo", event.target.value)
                          }
                          aria-invalid={Boolean(erroresVariable.maximo)}
                          disabled={ocupado}
                        />

                        {erroresVariable.maximo && (
                          <span className="form-error">
                            {erroresVariable.maximo}
                          </span>
                        )}
                      </div>
                    </div>

                    {erroresVariable.general && (
                      <div
                        className="message message--danger limites-mensaje"
                        role="alert"
                      >
                        {erroresVariable.general}
                      </div>
                    )}

                    {feedbackVariable && (
                      <div
                        className={`message message--${feedbackVariable.tipo} limites-mensaje`}
                        role={
                          feedbackVariable.tipo === "danger"
                            ? "alert"
                            : "status"
                        }
                      >
                        {feedbackVariable.texto}
                      </div>
                    )}

                    <div className="card__footer">
                      <button
                        type="submit"
                        className="limites-btn-guardar"
                        disabled={ocupado}
                      >
                        {guardandoEsta
                          ? MESSAGES.SAVING
                          : `Guardar ${titulo.toLowerCase()}`}
                      </button>
                    </div>
                  </form>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default ConfiguracionLimites;
