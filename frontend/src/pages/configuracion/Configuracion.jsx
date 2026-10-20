import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./Configuracion.css";

// Ajusta estas rutas a la estructura real de tu proyecto.
import { configRepository } from "../../repositories/configRepository";
import { ROUTES } from "../../routes";

const VALORES_INICIALES = {
  intervaloReporteSegundos: "",
  retencionHistoricoMeses: "",
  purgaAutomatica: false,
};

function normalizarConfiguracion(configuracion) {
  return {
    intervaloReporteSegundos:
      configuracion?.intervaloReporteSegundos ?? "",
    retencionHistoricoMeses:
      configuracion?.retencionHistoricoMeses ?? "",
    purgaAutomatica: configuracion?.purgaAutomatica ?? false,
  };
}

export default function Configuracion() {
  const [formulario, setFormulario] = useState(VALORES_INICIALES);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");
  const [errorValidacion, setErrorValidacion] = useState({});
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    let activo = true;

    const manejarConfiguracion = (configuracion) => {
      if (!activo) return;

      setFormulario(normalizarConfiguracion(configuracion));
      setCargando(false);
      setErrorCarga("");
    };

    try {
      const cancelar = configRepository.suscribirseAConfiguracion(
        manejarConfiguracion
      );

      return () => {
        activo = false;
        if (typeof cancelar === "function") cancelar();
      };
    } catch {
      setErrorCarga("No se pudo cargar la configuración.");
      setCargando(false);
      activo = false;
    }
  }, []);

  function actualizarCampo(campo, valor) {
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor,
    }));

    setErrorValidacion((actual) => ({
      ...actual,
      [campo]: "",
    }));

    setMensaje("");
  }

  function validar() {
    const errores = {};
    const intervalo = Number(formulario.intervaloReporteSegundos);
    const retencion = Number(formulario.retencionHistoricoMeses);

    /*
     * IMPORTANTE:
     * Sustituye los límites de este ejemplo por los mismos límites
     * que utilice configRepository en tu proyecto.
     */
    if (
      formulario.intervaloReporteSegundos === "" ||
      !Number.isInteger(intervalo) ||
      intervalo <= 0
    ) {
      errores.intervaloReporteSegundos =
        "Introduce un intervalo entero mayor que cero.";
    }

    if (
      formulario.retencionHistoricoMeses === "" ||
      !Number.isInteger(retencion) ||
      retencion < 12
    ) {
      errores.retencionHistoricoMeses =
        "La retención debe ser de al menos 12 meses.";
    }

    setErrorValidacion(errores);
    return Object.keys(errores).length === 0;
  }

  async function guardarConfiguracion(evento) {
    evento.preventDefault();
    setMensaje("");

    if (!validar()) return;

    if (
      formulario.purgaAutomatica &&
      !window.confirm(
        "¿Confirmas que deseas activar la purga automática? " +
          "Las mediciones que cumplan la política de retención " +
          "se eliminarán de forma definitiva. Exporta el histórico " +
          "antes de continuar."
      )
    ) {
      return;
    }

    setGuardando(true);

    try {
      const configuracion = {
        intervaloReporteSegundos: Number(
          formulario.intervaloReporteSegundos
        ),
        retencionHistoricoMeses: Number(
          formulario.retencionHistoricoMeses
        ),
        purgaAutomatica: Boolean(formulario.purgaAutomatica),
      };

      /*
       * Ajusta guardarConfiguracion al nombre y la firma
       * reales del método de escritura de tu repositorio.
       */
      await configRepository.guardarConfiguracion(configuracion);

      setMensaje("La configuración se guardó correctamente.");
      setErrorValidacion({});
    } catch (error) {
      setMensaje(
        error?.message ||
          "No se pudo guardar la configuración. Inténtalo de nuevo."
      );
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <main className="configuracion">
        <p role="status">Cargando configuración…</p>
      </main>
    );
  }

  if (errorCarga) {
    return (
      <main className="configuracion">
        <h1>Configuración</h1>
        <p className="configuracion__error" role="alert">
          {errorCarga}
        </p>
        <button
          type="button"
          className="configuracion__boton"
          onClick={() => window.location.reload()}
        >
          Reintentar
        </button>
      </main>
    );
  }

  return (
    <main className="configuracion">
      <header className="configuracion__cabecera">
        <div>
          <h1>Configuración</h1>
          <p>
            Administra los intervalos de reporte, la retención del
            histórico y la eliminación automática de mediciones.
          </p>
        </div>
      </header>

      <nav className="configuracion__navegacion" aria-label="Configuración">
        <Link to={ROUTES.THRESHOLDS}>
          Configurar límites de sensores
        </Link>

        {/* Sustituye ROUTES.HISTORICOS por la constante real de tu proyecto. */}
        <Link to={ROUTES.HISTORICOS}>
          Consultar históricos
        </Link>
      </nav>

      <form className="configuracion__formulario" onSubmit={guardarConfiguracion}>
        <section className="configuracion__seccion">
          <h2>Reporte de sensores</h2>

          <div className="configuracion__campo">
            <label htmlFor="intervaloReporte">
              Intervalo máximo de reporte de sensores (segundos)
            </label>

            <input
              id="intervaloReporte"
              name="intervaloReporteSegundos"
              type="number"
              min="1"
              step="1"
              required
              value={formulario.intervaloReporteSegundos}
              aria-invalid={Boolean(errorValidacion.intervaloReporteSegundos)}
              aria-describedby="intervalo-ayuda intervalo-error"
              onChange={(evento) =>
                actualizarCampo(
                  "intervaloReporteSegundos",
                  evento.target.value
                )
              }
            />

            <p id="intervalo-ayuda" className="configuracion__ayuda">
              Un dispositivo se considera desconectado tras{" "}
              <strong>
                {Number(formulario.intervaloReporteSegundos) * 3 || 0} s
              </strong>{" "}
              sin datos (3 × el intervalo).
            </p>

            {errorValidacion.intervaloReporteSegundos && (
              <p
                id="intervalo-error"
                className="configuracion__error"
                role="alert"
              >
                {errorValidacion.intervaloReporteSegundos}
              </p>
            )}
          </div>
        </section>

        <section className="configuracion__seccion">
          <h2>Retención del histórico</h2>

          <div className="configuracion__campo">
            <label htmlFor="retencionHistorico">
              Retención del histórico (meses)
            </label>

            <input
              id="retencionHistorico"
              name="retencionHistoricoMeses"
              type="number"
              min="12"
              step="1"
              required
              value={formulario.retencionHistoricoMeses}
              aria-invalid={Boolean(errorValidacion.retencionHistoricoMeses)}
              aria-describedby="retencion-aviso retencion-error"
              onChange={(evento) =>
                actualizarCampo(
                  "retencionHistoricoMeses",
                  evento.target.value
                )
              }
            />

            <div
              id="retencion-aviso"
              className="configuracion__aviso"
              role="note"
            >
              <strong>Importante: eliminación definitiva.</strong>
              <p>
                La purga borra mediciones de forma permanente. El mínimo
                permitido es de 12 meses. Se recomienda exportar el
                histórico antes de activar la purga automática.
              </p>
              <Link to={ROUTES.HISTORICOS}>
                Ir a Históricos para exportar los datos
              </Link>
            </div>

            {errorValidacion.retencionHistoricoMeses && (
              <p
                id="retencion-error"
                className="configuracion__error"
                role="alert"
              >
                {errorValidacion.retencionHistoricoMeses}
              </p>
            )}
          </div>
        </section>

        <section className="configuracion__seccion">
          <h2>Purga automática</h2>

          <div className="configuracion__interruptor">
            <div>
              <label htmlFor="purgaAutomatica">
                Activar purga automática
              </label>
              <p className="configuracion__ayuda">
                Permite eliminar automáticamente las mediciones que
                superen el período de retención configurado.
              </p>
            </div>

            <input
              id="purgaAutomatica"
              name="purgaAutomatica"
              type="checkbox"
              role="switch"
              checked={formulario.purgaAutomatica}
              onChange={(evento) =>
                actualizarCampo("purgaAutomatica", evento.target.checked)
              }
            />
          </div>
        </section>

        {mensaje && (
          <p
            className={
              mensaje.includes("correctamente")
                ? "configuracion__exito"
                : "configuracion__error"
            }
            role="status"
          >
            {mensaje}
          </p>
        )}

        <div className="configuracion__acciones">
          <button
            type="submit"
            className="configuracion__boton"
            disabled={guardando}
          >
            {guardando ? "Guardando…" : "Guardar configuración"}
          </button>
        </div>
      </form>
    </main>
  );
}