
import { useCallback, useEffect, useMemo, useState } from "react";

import incubadorasRepository from "../../repositories/incubadorasRepository";
import estadisticasRepository from "../../repositories/estadisticasRepository";

import { agruparPorPeriodo } from "../../utils/estadisticasUtils";
import { formatDateTime } from "../../utils/dateUtils";
import TrendChart from "../../components/charts/TrendChart";

import "./Estadisticas.css";

const VARIABLES = [
  { value: "temperatura", label: "Temperatura", unidad: "°C" },
  { value: "humedad", label: "Humedad", unidad: "%" },
];

const PERIODOS = [
  { value: "dia", label: "Día" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mes" },
];

function fechaLocalISO(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
}

function obtenerAyer() {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - 1);
  return fecha;
}

function obtenerInicioPeriodo(periodo, fechaFinal) {
  const inicio = new Date(fechaFinal);
  inicio.setHours(0, 0, 0, 0);

  if (periodo === "dia") {
    return inicio;
  }

  if (periodo === "semana") {
    inicio.setDate(inicio.getDate() - 6);
    return inicio;
  }

  inicio.setDate(1);
  return inicio;
}

function inicioDelDia(fecha) {
  return new Date(`${fecha}T00:00:00`);
}

function finDelDia(fecha) {
  return new Date(`${fecha}T23:59:59.999`);
}

function numeroValido(...valores) {
  for (const valor of valores) {
    if (valor !== undefined && valor !== null && valor !== "") {
      const numero = Number(valor);
      if (Number.isFinite(numero)) return numero;
    }
  }

  return null;
}

function obtenerIdIncubadora(incubadora) {
  return incubadora.id ?? incubadora.incubadoraId;
}

function obtenerNombreIncubadora(incubadora) {
  return (
    incubadora.nombre ??
    incubadora.nombreIncubadora ??
    String(obtenerIdIncubadora(incubadora))
  );
}

function formatearNumero(valor, unidad = "") {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) {
    return "—";
  }

  return `${valor.toLocaleString("es-CO", {
    maximumFractionDigits: 2,
  })}${unidad ? ` ${unidad}` : ""}`;
}

function calcularResumen(datos) {
  const valores = datos
    .map((dato) =>
      numeroValido(dato.promedio, dato.media, dato.valorPromedio)
    )
    .filter((valor) => valor !== null);

  const maximos = datos
    .map((dato) =>
      numeroValido(dato.maximo, dato.max, dato.valorMaximo)
    )
    .filter((valor) => valor !== null);

  const minimos = datos
    .map((dato) =>
      numeroValido(dato.minimo, dato.min, dato.valorMinimo)
    )
    .filter((valor) => valor !== null);

  if (valores.length === 0) {
    return {
      promedio: null,
      maximo: null,
      minimo: null,
      desviacion: null,
    };
  }

  const promedio =
    valores.reduce((suma, valor) => suma + valor, 0) / valores.length;

  const varianza =
    valores.reduce((suma, valor) => suma + (valor - promedio) ** 2, 0) /
    valores.length;

  return {
    promedio,
    maximo: maximos.length ? Math.max(...maximos) : Math.max(...valores),
    minimo: minimos.length ? Math.min(...minimos) : Math.min(...valores),
    desviacion: Math.sqrt(varianza),
  };
}

function obtenerFechaDato(dato) {
  return (
    dato.fecha ??
    dato.dia ??
    dato.fechaEstadistica ??
    dato.medidoEn
  );
}

function obtenerPromedio(dato) {
  return numeroValido(
    dato.promedio,
    dato.media,
    dato.valorPromedio,
    dato.valor
  );
}

export default function Estadisticas() {
  const ayer = useMemo(() => obtenerAyer(), []);

  const [incubadoras, setIncubadoras] = useState([]);
  const [incubadoraId, setIncubadoraId] = useState("");
  const [variable, setVariable] = useState("temperatura");
  const [periodo, setPeriodo] = useState("semana");

  const [desde, setDesde] = useState(
    fechaLocalISO(obtenerInicioPeriodo("semana", ayer))
  );
  const [hasta, setHasta] = useState(fechaLocalISO(ayer));

  const [estadisticas, setEstadisticas] = useState([]);
  const [cargandoIncubadoras, setCargandoIncubadoras] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [consultado, setConsultado] = useState(false);

  const variableSeleccionada = VARIABLES.find(
    (item) => item.value === variable
  );

  useEffect(() => {
    let activo = true;

    async function cargarIncubadoras() {
      setCargandoIncubadoras(true);

      try {
        const resultado =
          await incubadorasRepository.obtenerIncubadoras();

        const lista = Array.isArray(resultado)
          ? resultado
          : resultado?.incubadoras ?? [];

        if (!activo) return;

        setIncubadoras(lista);

        if (lista.length > 0) {
          setIncubadoraId(String(obtenerIdIncubadora(lista[0])));
        }
      } catch (err) {
        if (activo) {
          setError("No fue posible cargar las incubadoras.");
        }
      } finally {
        if (activo) setCargandoIncubadoras(false);
      }
    }

    cargarIncubadoras();

    return () => {
      activo = false;
    };
  }, []);

  const cambiarPeriodo = (nuevoPeriodo) => {
    setPeriodo(nuevoPeriodo);

    const fechaFinal = new Date(`${hasta}T12:00:00`);
    const fechaInicial = obtenerInicioPeriodo(nuevoPeriodo, fechaFinal);

    setDesde(fechaLocalISO(fechaInicial));
  };

  const consultarEstadisticas = useCallback(async () => {
    if (!incubadoraId) {
      setError("Selecciona una incubadora.");
      return;
    }

    if (!desde || !hasta || desde > hasta) {
      setError("Selecciona un rango de fechas válido.");
      return;
    }

    if (hasta > fechaLocalISO(ayer)) {
      setError("Las estadísticas solo están disponibles hasta ayer.");
      return;
    }

    setCargando(true);
    setError("");
    setConsultado(false);
    setEstadisticas([]);

    try {
      const resultado =
        await estadisticasRepository.obtenerEstadisticasPorRango({
          incubadoraId,
          variable,
          desde: inicioDelDia(desde),
          hasta: finDelDia(hasta),
        });

      const lista = Array.isArray(resultado)
        ? resultado
        : resultado?.estadisticas ?? [];

      const agrupadas = agruparPorPeriodo(lista, periodo);

      setEstadisticas(Array.isArray(agrupadas) ? agrupadas : []);
      setConsultado(true);
    } catch (err) {
      console.error("Error al consultar estadísticas:", err);
      setError("No fue posible cargar las estadísticas. Inténtalo nuevamente.");
    } finally {
      setCargando(false);
    }
  }, [incubadoraId, variable, periodo, desde, hasta, ayer]);

  const resumen = useMemo(
    () => calcularResumen(estadisticas),
    [estadisticas]
  );

  const datosGrafico = useMemo(
    () =>
      estadisticas
        .map((dato) => ({
          fecha: obtenerFechaDato(dato),
          valor: obtenerPromedio(dato),
        }))
        .filter(
          (dato) =>
            dato.fecha != null &&
            dato.valor !== null &&
            !Number.isNaN(new Date(dato.fecha).getTime())
        ),
    [estadisticas]
  );

  const unidad = variableSeleccionada?.unidad ?? "";

  return (
    <main className="estadisticas">
      <header className="estadisticas__header">
        <div>
          <h1>Estadísticas</h1>
          <p>Analiza el comportamiento de las mediciones por período.</p>
        </div>
      </header>

      <aside className="estadisticas__aviso" role="note">
        Incluye datos hasta ayer; las estadísticas de hoy se calculan durante
        la madrugada
      </aside>

      <section className="estadisticas__filtros">
        <div className="estadisticas__campo">
          <label htmlFor="estadisticas-incubadora">Incubadora</label>
          <select
            id="estadisticas-incubadora"
            value={incubadoraId}
            onChange={(e) => setIncubadoraId(e.target.value)}
            disabled={cargandoIncubadoras || incubadoras.length === 0}
          >
            <option value="">
              {cargandoIncubadoras
                ? "Cargando incubadoras..."
                : "Selecciona una incubadora"}
            </option>

            {incubadoras.map((incubadora) => {
              const id = String(obtenerIdIncubadora(incubadora));

              return (
                <option key={id} value={id}>
                  {obtenerNombreIncubadora(incubadora)}
                </option>
              );
            })}
          </select>
        </div>

        <div className="estadisticas__campo">
          <label htmlFor="estadisticas-variable">Variable</label>
          <select
            id="estadisticas-variable"
            value={variable}
            onChange={(e) => setVariable(e.target.value)}
          >
            {VARIABLES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="estadisticas__campo">
          <label htmlFor="estadisticas-periodo">Período</label>
          <select
            id="estadisticas-periodo"
            value={periodo}
            onChange={(e) => cambiarPeriodo(e.target.value)}
          >
            {PERIODOS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="estadisticas__campo">
          <label htmlFor="estadisticas-desde">Desde</label>
          <input
            id="estadisticas-desde"
            type="date"
            value={desde}
            max={hasta}
            onChange={(e) => setDesde(e.target.value)}
          />
        </div>

        <div className="estadisticas__campo">
          <label htmlFor="estadisticas-hasta">Hasta</label>
          <input
            id="estadisticas-hasta"
            type="date"
            value={hasta}
            min={desde}
            max={fechaLocalISO(ayer)}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>

        <button
          className="estadisticas__boton"
          type="button"
          onClick={consultarEstadisticas}
          disabled={cargando || cargandoIncubadoras || !incubadoraId}
        >
          {cargando ? "Consultando..." : "Consultar"}
        </button>
      </section>

      {error && (
        <div
          className="estadisticas__estado estadisticas__estado--error"
          role="alert"
        >
          {error}
        </div>
      )}

      {cargando && (
        <div className="estadisticas__estado" role="status">
          Cargando estadísticas...
        </div>
      )}

      {!cargando && consultado && estadisticas.length === 0 && !error && (
        <div className="estadisticas__estado">
          No hay estadísticas para los filtros seleccionados.
        </div>
      )}

      {!cargando && estadisticas.length > 0 && (
        <>
          <section className="estadisticas__resumen">
            <article className="estadisticas__tarjeta">
              <span>Promedio</span>
              <strong>{formatearNumero(resumen.promedio, unidad)}</strong>
            </article>

            <article className="estadisticas__tarjeta">
              <span>Máximo</span>
              <strong>{formatearNumero(resumen.maximo, unidad)}</strong>
            </article>

            <article className="estadisticas__tarjeta">
              <span>Mínimo</span>
              <strong>{formatearNumero(resumen.minimo, unidad)}</strong>
            </article>

            <article className="estadisticas__tarjeta">
              <span>Desviación estándar</span>
              <strong>{formatearNumero(resumen.desviacion, unidad)}</strong>
            </article>
          </section>

          <section className="estadisticas__grafico">
            <TrendChart
              datos={datosGrafico}
              etiqueta={`${variableSeleccionada?.label} promedio`}
              unidad={unidad}
            />
          </section>

          <section className="estadisticas__detalle">
            <h2>Detalle por período</h2>

            <div className="estadisticas__tabla-contenedor">
              <table className="estadisticas__tabla">
                <thead>
                  <tr>
                    <th>Período</th>
                    <th>Promedio</th>
                    <th>Máximo</th>
                    <th>Mínimo</th>
                  </tr>
                </thead>
                <tbody>
                  {estadisticas.map((dato, indice) => {
                    const fecha = obtenerFechaDato(dato);

                    return (
                      <tr key={`${String(fecha)}-${indice}`}>
                        <td>
                          {fecha ? formatDateTime(fecha) : "—"}
                        </td>
                        <td>
                          {formatearNumero(
                            numeroValido(dato.promedio, dato.media, dato.valorPromedio),
                            unidad
                          )}
                        </td>
                        <td>
                          {formatearNumero(
                            numeroValido(dato.maximo, dato.max, dato.valorMaximo),
                            unidad
                          )}
                        </td>
                        <td>
                          {formatearNumero(
                            numeroValido(dato.minimo, dato.min, dato.valorMinimo),
                            unidad
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
