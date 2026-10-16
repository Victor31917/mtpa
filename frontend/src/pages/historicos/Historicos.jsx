
import { useCallback, useEffect, useState } from "react";

import { obtenerMedicionesPorRango } from "../../repositories/medicionesRepository";
import incubadorasRepository from "../../repositories/incubadorasRepository";
import umbralesRepository from "../../repositories/umbralesRepository";

import TrendChart from "../../components/charts/TrendChart";
import { formatDateTime } from "../../utils/dateUtils";

import "./Historicos.css";

const VARIABLES = [
  { value: "temperatura", label: "Temperatura", unidad: "°C" },
  { value: "humedad", label: "Humedad", unidad: "%" },
];

const FECHA_INICIAL = () => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - 7);
  return fecha;
};

function obtenerFechaInput(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
}

function inicioDelDia(fecha) {
  return new Date(`${fecha}T00:00:00`);
}

function finDelDia(fecha) {
  return new Date(`${fecha}T23:59:59.999`);
}

function formatearValor(valor) {
  return Number(valor).toLocaleString("es-CO", {
    maximumFractionDigits: 2,
  });
}

function obtenerIdIncubadora(incubadora) {
  return incubadora.id ?? incubadora.incubadoraId;
}

function obtenerNombreIncubadora(incubadora) {
  return (
    incubadora.nombre ??
    incubadora.nombreIncubadora ??
    obtenerIdIncubadora(incubadora)
  );
}

export default function Historicos() {
  const [incubadoras, setIncubadoras] = useState([]);
  const [incubadoraId, setIncubadoraId] = useState("");
  const [variable, setVariable] = useState("temperatura");

  const [desde, setDesde] = useState(obtenerFechaInput(FECHA_INICIAL()));
  const [hasta, setHasta] = useState(obtenerFechaInput(new Date()));

  const [mediciones, setMediciones] = useState([]);
  const [umbrales, setUmbrales] = useState(null);

  const [cargandoIncubadoras, setCargandoIncubadoras] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [truncado, setTruncado] = useState(false);
  const [consultado, setConsultado] = useState(false);

  const variableSeleccionada = VARIABLES.find(
    (item) => item.value === variable
  );

  useEffect(() => {
    let activo = true;

    async function cargarIncubadoras() {
      setCargandoIncubadoras(true);
      setError("");

      try {
        // Ajusta este método al nombre real de tu repository.
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

  const consultarHistoricos = useCallback(async () => {
    if (!incubadoraId) {
      setError("Selecciona una incubadora.");
      return;
    }

    if (!desde || !hasta || desde > hasta) {
      setError("Selecciona un rango de fechas válido.");
      return;
    }

    setCargando(true);
    setError("");
    setTruncado(false);
    setConsultado(false);
    setMediciones([]);
    setUmbrales(null);

    try {
      const [resultado, resultadoUmbrales] = await Promise.all([
        obtenerMedicionesPorRango({
          incubadoraId,
          variable,
          desde: inicioDelDia(desde),
          hasta: finDelDia(hasta),
        }),

        // Ajusta esta llamada a la firma real de umbralesRepository.
        umbralesRepository.obtenerUmbral({
          incubadoraId,
          variable,
        }),
      ]);

      setMediciones(resultado.mediciones ?? []);
      setTruncado(Boolean(resultado.truncado));
      setUmbrales(resultadoUmbrales ?? null);
      setConsultado(true);
    } catch (err) {
      console.error("Error al consultar históricos:", err);
      setError("No fue posible cargar el histórico. Inténtalo nuevamente.");
    } finally {
      setCargando(false);
    }
  }, [incubadoraId, variable, desde, hasta]);

  const unidad = variableSeleccionada?.unidad ?? "";

  const minimo =
    umbrales?.minimo ??
    umbrales?.min ??
    umbrales?.umbralMinimo;

  const maximo =
    umbrales?.maximo ??
    umbrales?.max ??
    umbrales?.umbralMaximo;

  return (
    <main className="historicos">
      <header className="historicos__header">
        <div>
          <h1>Histórico de mediciones</h1>
          <p>
            Consulta y analiza la evolución de la temperatura y la humedad.
          </p>
        </div>
      </header>

      <section className="historicos__filtros">
        <div className="historicos__campo">
          <label htmlFor="historicos-incubadora">Incubadora</label>

          <select
            id="historicos-incubadora"
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

        <div className="historicos__campo">
          <label htmlFor="historicos-variable">Variable</label>

          <select
            id="historicos-variable"
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

        <div className="historicos__campo">
          <label htmlFor="historicos-desde">Desde</label>

          <input
            id="historicos-desde"
            type="date"
            value={desde}
            max={hasta}
            onChange={(e) => setDesde(e.target.value)}
          />
        </div>

        <div className="historicos__campo">
          <label htmlFor="historicos-hasta">Hasta</label>

          <input
            id="historicos-hasta"
            type="date"
            value={hasta}
            min={desde}
            max={obtenerFechaInput(new Date())}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>

        <button
          className="historicos__boton"
          type="button"
          onClick={consultarHistoricos}
          disabled={cargando || cargandoIncubadoras || !incubadoraId}
        >
          {cargando ? "Consultando..." : "Consultar"}
        </button>
      </section>

      {error && (
        <div className="historicos__mensaje historicos__mensaje--error" role="alert">
          {error}
        </div>
      )}

      {truncado && (
        <div
          className="historicos__mensaje historicos__mensaje--aviso"
          role="status"
        >
          Se muestran únicamente las primeras mediciones hasta alcanzar el
          límite de la consulta. Selecciona un rango de fechas más corto o
          consulta la pantalla de estadísticas.
        </div>
      )}

      {cargando && (
        <div className="historicos__estado" role="status">
          Cargando mediciones históricas...
        </div>
      )}

      {!cargando && consultado && mediciones.length === 0 && !error && (
        <div className="historicos__estado">
          No hay mediciones para la incubadora, variable y fechas seleccionadas.
        </div>
      )}

      {!cargando && mediciones.length > 0 && (
        <>
          <section className="historicos__grafico">
            <TrendChart
              datos={mediciones.map((medicion) => ({
                fecha: medicion.medidoEn,
                valor: medicion.valor,
              }))}
              etiqueta={variableSeleccionada?.label}
              unidad={unidad}
              minimo={minimo}
              maximo={maximo}
            />
          </section>

          <section className="historicos__tabla-seccion">
            <div className="historicos__tabla-header">
              <h2>Detalle de mediciones</h2>
              <span>{mediciones.length} registros</span>
            </div>

            <div className="historicos__tabla-contenedor">
              <table className="historicos__tabla">
                <thead>
                  <tr>
                    <th>Fecha y hora</th>
                    <th>Variable</th>
                    <th>Valor</th>
                    <th>Unidad</th>
                  </tr>
                </thead>

                <tbody>
                  {mediciones.map((medicion, indice) => (
                    <tr
                      key={
                        medicion.id ??
                        `${medicion.medidoEn?.getTime?.() ?? indice}-${indice}`
                      }
                    >
                      <td>
                        {formatDateTime(medicion.medidoEn)}
                      </td>
                      <td>{variableSeleccionada?.label}</td>
                      <td>{formatearValor(medicion.valor)}</td>
                      <td>{unidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
