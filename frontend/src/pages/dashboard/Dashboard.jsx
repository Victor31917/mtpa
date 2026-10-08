import { useEffect, useMemo, useState } from "react";

import useAuth from "../../hooks/useAuth";

import incubadorasRepository from "../../repositories/incubadorasRepository";
import medicionesRepository from "../../repositories/medicionesRepository";
import dispositivosRepository from "../../repositories/dispositivosRepository";

import ConnectionStatus from "../../components/dashboard/ConnectionStatus";
import FanStatusCard from "../../components/dashboard/FanStatusCard";
import GeneralStatusCard from "../../components/dashboard/GeneralStatusCard";
import HumidityCard from "../../components/dashboard/HumidityCard";
import LastUpdateCard from "../../components/dashboard/LastUpdateCard";
import TemperatureCard from "../../components/dashboard/TemperatureCard";

import "./Dashboard.css";

const toMillis = (value) => {
  if (!value) return 0;

  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number") {
    return value;
  }

  const parsed = new Date(value).getTime();

  return Number.isNaN(parsed) ? 0 : parsed;
};

const latestByVariable = (mediciones, variable) =>
  mediciones
    .filter((medicion) => medicion.variable === variable)
    .sort(
      (a, b) =>
        toMillis(b.medidoEn) -
        toMillis(a.medidoEn)
    )[0] ?? null;

const Dashboard = () => {
  const { usuario } = useAuth();

  const [incubadoras, setIncubadoras] = useState([]);
  const [incubadoraId, setIncubadoraId] = useState("");

  const [mediciones, setMediciones] = useState([]);
  const [dispositivos, setDispositivos] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  /*
   * =========================================================
   * CARGAR INCUBADORAS
   * =========================================================
   */

  useEffect(() => {
    let activo = true;

    const cargarIncubadoras = async () => {
      try {
        const datos =
          await incubadorasRepository.listarIncubadoras();

        if (!activo) return;

        const disponibles = datos.filter(
          (incubadora) =>
            incubadora.estado !== "inactiva"
        );

        setIncubadoras(disponibles);

        setIncubadoraId(
          (actual) =>
            actual ||
            disponibles[0]?.id ||
            datos[0]?.id ||
            ""
        );
      } catch (err) {
        console.error(
          "No fue posible cargar las incubadoras:",
          err
        );

        if (activo) {
          setError(
            "No fue posible cargar las incubadoras."
          );
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    };

    cargarIncubadoras();

    return () => {
      activo = false;
    };
  }, []);

  /*
   * Al cambiar de incubadora se descartan los datos y el error
   * de la anterior para no mostrarlos mientras llegan los nuevos.
   */

  const cambiarIncubadora = (nuevaIncubadoraId) => {
    setMediciones([]);
    setDispositivos([]);
    setError("");
    setIncubadoraId(nuevaIncubadoraId);
  };

  /*
   * =========================================================
   * SUSCRIPCIONES EN TIEMPO REAL
   * =========================================================
   *
   * IMPORTANTE:
   *
   * 1. medicionesRepository escucha MEDICIONES.
   * 2. dispositivosRepository escucha DISPOSITIVOS.
   *
   * Son dos repositories diferentes.
   */

  useEffect(() => {
    if (!incubadoraId) {
      return undefined;
    }

    /*
     * -------------------------------------------------------
     * SUSCRIPCIÓN A MEDICIONES
     * -------------------------------------------------------
     */

    const unsubscribeMediciones =
      medicionesRepository.suscribirseAMedicionesPorIncubadora(
        incubadoraId,
        (nuevasMediciones) => {
          setMediciones(nuevasMediciones);
        },
        (err) => {
          console.error(
            "Error en la suscripción de mediciones:",
            err
          );

          setError(
            "No fue posible actualizar las mediciones en tiempo real."
          );
        }
      );

    /*
     * -------------------------------------------------------
     * SUSCRIPCIÓN A DISPOSITIVOS
     * -------------------------------------------------------
     */

    const unsubscribeDispositivos =
      dispositivosRepository.suscribirseADispositivosPorIncubadora(
        incubadoraId,
        (nuevosDispositivos) => {
          setDispositivos(nuevosDispositivos);
        },
        (err) => {
          console.error(
            "Error en la suscripción de dispositivos:",
            err
          );

          setError(
            "No fue posible actualizar el estado de conexión de los dispositivos."
          );
        }
      );

    /*
     * -------------------------------------------------------
     * CLEANUP
     * -------------------------------------------------------
     *
     * Se cancelan AMBAS suscripciones al:
     *
     * - cambiar de incubadora
     * - desmontar Dashboard
     */

    return () => {
      unsubscribeMediciones();
      unsubscribeDispositivos();
    };
  }, [incubadoraId]);

  /*
   * =========================================================
   * DATOS DERIVADOS
   * =========================================================
   */

  const incubadoraSeleccionada = useMemo(
    () =>
      incubadoras.find(
        (item) => item.id === incubadoraId
      ) ?? null,
    [incubadoras, incubadoraId]
  );

  const temperatura = useMemo(
    () =>
      latestByVariable(
        mediciones,
        "temperatura"
      ),
    [mediciones]
  );

  const humedad = useMemo(
    () =>
      latestByVariable(
        mediciones,
        "humedad"
      ),
    [mediciones]
  );

  const ultimaMedicion = useMemo(
    () =>
      mediciones
        .slice()
        .sort(
          (a, b) =>
            toMillis(b.medidoEn) -
            toMillis(a.medidoEn)
        )[0] ?? null,
    [mediciones]
  );

  const ventiladores = useMemo(
    () =>
      dispositivos.filter(
        (dispositivo) =>
          dispositivo.tipo === "ventilador"
      ),
    [dispositivos]
  );

  const estadoGeneral = useMemo(() => {
    if (!incubadoraSeleccionada) {
      return "sin_datos";
    }

    const desconectado =
      dispositivos.some(
        (dispositivo) =>
          dispositivo.estadoConexion ===
          "desconectado"
      );

    if (desconectado) {
      return "advertencia";
    }

    if (temperatura || humedad) {
      return "normal";
    }

    return "sin_datos";
  }, [
    incubadoraSeleccionada,
    temperatura,
    humedad,
    dispositivos,
  ]);

  /*
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (cargando) {
    return (
      <section className="dashboard-page">
        <p className="dashboard-message">
          Cargando panel general...
        </p>
      </section>
    );
  }

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <section className="dashboard-page">
      <header className="dashboard-page__header">
        <div>
          <p className="dashboard-page__eyebrow">
            M.T.P.A.
          </p>

          <h1>Panel general</h1>

          <p>
            Bienvenido
            {usuario?.nombre
              ? `, ${usuario.nombre}`
              : ""}
            .
          </p>
        </div>

        {incubadoras.length > 0 && (
          <label className="dashboard-selector">
            <span>Incubadora</span>

            <select
              value={incubadoraId}
              onChange={(event) =>
                cambiarIncubadora(
                  event.target.value
                )
              }
            >
              {incubadoras.map(
                (incubadora) => (
                  <option
                    key={incubadora.id}
                    value={incubadora.id}
                  >
                    {incubadora.nombre ||
                      incubadora.id}
                  </option>
                )
              )}
            </select>
          </label>
        )}
      </header>

      {error && (
        <div className="dashboard-alert">
          {error}
        </div>
      )}

      {!incubadoraSeleccionada ? (
        <p className="dashboard-message">
          No hay incubadoras disponibles.
        </p>
      ) : (
        <>
          <div className="dashboard-incubator">
            <h2>
              {incubadoraSeleccionada.nombre ||
                incubadoraSeleccionada.id}
            </h2>

            {incubadoraSeleccionada.ubicacion && (
              <span>
                {incubadoraSeleccionada.ubicacion}
              </span>
            )}
          </div>

          <div className="dashboard-grid">

            {/* [02] Estado general */}
            <GeneralStatusCard
              incubadora={
                incubadoraSeleccionada
              }
              estado={estadoGeneral}
              temperatura={temperatura}
              humedad={humedad}
              dispositivos={dispositivos}
            />

            {/* [03] Temperatura */}
            <TemperatureCard
              medicion={temperatura}
            />

            {/* [04] Humedad */}
            <HumidityCard
              medicion={humedad}
            />

            {/* [05] Última actualización */}
            <LastUpdateCard
              medicion={ultimaMedicion}
            />

            {/* [06] Estado de conexión */}
            <ConnectionStatus
              dispositivos={dispositivos}
            />

            {/* [07] Estado de ventiladores */}
            <FanStatusCard
              ventiladores={ventiladores}
            />

          </div>
        </>
      )}
    </section>
  );
};

export default Dashboard;