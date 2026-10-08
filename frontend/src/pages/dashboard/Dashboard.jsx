import { useEffect, useMemo, useState } from "react";

import useAuth from "../../hooks/useAuth";

import alertasRepository from "../../repositories/alertasRepository";
import incubadorasRepository from "../../repositories/incubadorasRepository";
import medicionesRepository from "../../repositories/medicionesRepository";
import dispositivosRepository from "../../repositories/dispositivosRepository";
import umbralesRepository from "../../repositories/umbralesRepository";

import ConnectionStatus from "../../components/dashboard/ConnectionStatus";
import FanStatusCard from "../../components/dashboard/FanStatusCard";
import GeneralStatusCard from "../../components/dashboard/GeneralStatusCard";
import HumidityCard from "../../components/dashboard/HumidityCard";
import LastUpdateCard from "../../components/dashboard/LastUpdateCard";
import QuickSummary from "../../components/dashboard/QuickSummary";
import TemperatureCard from "../../components/dashboard/TemperatureCard";

import { ALERT_STATUS } from "../../utils/constants";
import { calcularEstadoGeneral } from "../../utils/estadoGeneral";

import "./Dashboard.css";

// Alertas activas leídas para el estado general. alertasRepository aplica
// el límite ANTES de filtrar por estado: una alerta activa que no esté
// entre las últimas LIMITE_ALERTAS_ACTIVAS alertas (de cualquier estado)
// no se cuenta.
const LIMITE_ALERTAS_ACTIVAS = 200;

// Umbral configurado ({ minimo, maximo }) al formato { min, max } que
// esperan TemperatureCard y HumidityCard; sin umbral no se resalta nada.
const aUmbralDeTarjeta = (umbral) =>
  umbral ? { min: umbral.minimo, max: umbral.maximo } : undefined;

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
  const [umbrales, setUmbrales] = useState(null);

  // Alertas activas y dispositivos de TODAS las incubadoras (null hasta
  // que llega el primer dato): alimentan el estado general y el resumen.
  const [alertasActivas, setAlertasActivas] = useState(null);
  const [todosDispositivos, setTodosDispositivos] = useState(null);

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
    setUmbrales(null);
    setError("");
    setIncubadoraId(nuevaIncubadoraId);
  };

  /*
   * =========================================================
   * SUSCRIPCIONES GLOBALES (TODAS LAS INCUBADORAS)
   * =========================================================
   *
   * Una sola suscripción a las alertas activas y otra a todos los
   * dispositivos (se asumen pocos): de ahí sale el estado general de
   * cada incubadora. Se cancelan ambas al desmontar el Dashboard.
   */

  useEffect(() => {
    const unsubscribeAlertas = alertasRepository.suscribirseAlertas(
      { estado: ALERT_STATUS.ACTIVE, limite: LIMITE_ALERTAS_ACTIVAS },
      (alertas) => {
        setAlertasActivas(alertas);
      },
      (err) => {
        console.error("Error en la suscripción de alertas:", err);

        setError("No fue posible actualizar las alertas en tiempo real.");
      }
    );

    const unsubscribeTodosDispositivos =
      dispositivosRepository.suscribirseATodosLosDispositivos(
        (todos) => {
          setTodosDispositivos(todos);
        },
        (err) => {
          console.error(
            "Error en la suscripción de todos los dispositivos:",
            err
          );

          setError("No fue posible actualizar el resumen de incubadoras.");
        }
      );

    return () => {
      unsubscribeAlertas();
      unsubscribeTodosDispositivos();
    };
  }, []);

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
     * SUSCRIPCIÓN A UMBRALES
     * -------------------------------------------------------
     */

    const unsubscribeUmbrales =
      umbralesRepository.suscribirseAUmbralesPorIncubadora(
        incubadoraId,
        (nuevosUmbrales) => {
          setUmbrales(nuevosUmbrales);
        },
        (err) => {
          console.error(
            "Error en la suscripción de umbrales:",
            err
          );

          setError(
            "No fue posible actualizar los límites configurados."
          );
        }
      );

    /*
     * -------------------------------------------------------
     * CLEANUP
     * -------------------------------------------------------
     *
     * Se cancelan TODAS las suscripciones al:
     *
     * - cambiar de incubadora
     * - desmontar Dashboard
     */

    return () => {
      unsubscribeMediciones();
      unsubscribeDispositivos();
      unsubscribeUmbrales();
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

  // ConnectionStatus: la incubadora se considera conectada si al menos
  // un dispositivo lo está; la última comunicación es la más reciente.
  const conexion = useMemo(() => {
    const conectado = dispositivos.some(
      (dispositivo) =>
        dispositivo.estadoConexion ===
        "conectado"
    );

    const ultimaComunicacionEn =
      dispositivos.reduce(
        (ultima, dispositivo) =>
          toMillis(
            dispositivo.ultimaComunicacionEn
          ) > toMillis(ultima)
            ? dispositivo.ultimaComunicacionEn
            : ultima,
        null
      );

    return {
      estadoConexion: conectado
        ? "conectado"
        : "desconectado",
      ultimaComunicacionEn,
    };
  }, [dispositivos]);

  // Estado general de la incubadora seleccionada: "sin_datos" mientras no
  // haya nada que evaluar (alertas sin cargar, o sin mediciones ni
  // dispositivos); si no, lo decide calcularEstadoGeneral.
  const estadoGeneral = useMemo(() => {
    if (
      !incubadoraSeleccionada ||
      alertasActivas === null ||
      (!temperatura && !humedad && dispositivos.length === 0)
    ) {
      return "sin_datos";
    }

    return calcularEstadoGeneral({
      alertasActivas: alertasActivas.filter(
        (alerta) => alerta.incubadoraId === incubadoraSeleccionada.id
      ),
      dispositivos,
    });
  }, [
    incubadoraSeleccionada,
    alertasActivas,
    temperatura,
    humedad,
    dispositivos,
  ]);

  // Estado general de CADA incubadora, para el resumen (RF-017). Hasta
  // que llegan alertas y dispositivos no hay resumen que mostrar.
  const resumenIncubadoras = useMemo(() => {
    if (alertasActivas === null || todosDispositivos === null) {
      return null;
    }

    return incubadoras.map((incubadora) => ({
      id: incubadora.id,
      nombre: incubadora.nombre || incubadora.id,
      estadoGeneral: calcularEstadoGeneral({
        alertasActivas: alertasActivas.filter(
          (alerta) => alerta.incubadoraId === incubadora.id
        ),
        dispositivos: todosDispositivos.filter(
          (dispositivo) => dispositivo.incubadoraId === incubadora.id
        ),
      }),
    }));
  }, [incubadoras, alertasActivas, todosDispositivos]);

  /*
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (cargando) {
    return (
      <section className="page dashboard-page">
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
    <section className="page dashboard-page">
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

      {resumenIncubadoras && resumenIncubadoras.length > 0 && (
        <QuickSummary incubadoras={resumenIncubadoras} />
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
              umbral={aUmbralDeTarjeta(
                umbrales?.temperatura
              )}
            />

            {/* [04] Humedad */}
            <HumidityCard
              medicion={humedad}
              umbral={aUmbralDeTarjeta(
                umbrales?.humedad
              )}
            />

            {/* [05] Última actualización */}
            <LastUpdateCard
              medicion={ultimaMedicion}
            />

            {/* [06] Estado de conexión */}
            <ConnectionStatus
              estadoConexion={
                conexion.estadoConexion
              }
              ultimaComunicacionEn={
                conexion.ultimaComunicacionEn
              }
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