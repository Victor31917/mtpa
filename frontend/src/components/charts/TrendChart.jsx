
import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

import { formatDateTime } from "../../utils/dateUtils";
import "./TrendChart.css";

function convertirFecha(fecha) {
  if (fecha instanceof Date) {
    return fecha;
  }

  if (fecha && typeof fecha.toDate === "function") {
    return fecha.toDate();
  }

  return new Date(fecha);
}

function formatearFecha(fecha) {
  const date = convertirFecha(fecha);

  if (Number.isNaN(date.getTime())) {
    return "Fecha inválida";
  }

  return formatDateTime(date);
}

function TooltipPersonalizado({ active, payload, unidad }) {
  if (!active || !payload?.length) {
    return null;
  }

  const dato = payload[0].payload;

  return (
    <div className="trend-chart-tooltip">
      <p className="trend-chart-tooltip-date">
        {formatearFecha(dato.fecha)}
      </p>

      <p className="trend-chart-tooltip-value">
        {dato.valor} {unidad}
      </p>
    </div>
  );
}

export default function TrendChart({
  datos = [],
  etiqueta = "Medición",
  unidad = "",
  minimo,
  maximo,
  cargando = false,
  error = null,
}) {
  const datosValidos = useMemo(() => {
    if (!Array.isArray(datos)) {
      return [];
    }

    return datos
      .filter((dato) => {
        if (!dato || dato.fecha == null || dato.valor == null) {
          return false;
        }

        const fecha = convertirFecha(dato.fecha);
        const valor = Number(dato.valor);

        return (
          !Number.isNaN(fecha.getTime()) &&
          Number.isFinite(valor)
        );
      })
      .map((dato) => ({
        fecha: convertirFecha(dato.fecha),
        valor: Number(dato.valor),
      }))
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  }, [datos]);

  if (cargando) {
    return (
      <div className="trend-chart-state" role="status">
        <span className="trend-chart-spinner" />
        <p>Cargando mediciones...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="trend-chart-state trend-chart-error" role="alert">
        <p>No fue posible cargar el gráfico.</p>
        <span>{typeof error === "string" ? error : "Inténtalo nuevamente."}</span>
      </div>
    );
  }

  if (datosValidos.length === 0) {
    return (
      <div className="trend-chart-state">
        <p>No hay mediciones disponibles para mostrar.</p>
        <span>Selecciona otro rango de fechas o verifica los datos.</span>
      </div>
    );
  }

  return (
    <section className="trend-chart-card">
      <div className="trend-chart-header">
        <h3>{etiqueta}</h3>
        <span className="trend-chart-unit">{unidad}</span>
      </div>

      <div className="trend-chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={datosValidos}
            margin={{ top: 12, right: 12, left: 0, bottom: 12 }}
          >
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis
              dataKey="fecha"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(valor) => {
                const fecha = new Date(valor);

                return fecha.toLocaleString("es-CO", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                });
              }}
              tick={{ fontSize: 11 }}
              minTickGap={25}
              angle={-25}
              textAnchor="end"
              height={55}
              tickMargin={8}
            />

            <YAxis
              tickFormatter={(valor) => `${valor} ${unidad}`}
              tick={{ fontSize: 11 }}
              width={65}
              domain={["auto", "auto"]}
              label={{
                value: unidad,
                angle: -90,
                position: "insideLeft",
                style: { textAnchor: "middle" },
              }}
            />

            <Tooltip
              content={<TooltipPersonalizado unidad={unidad} />}
            />

            {minimo !== undefined && minimo !== null && (
              <ReferenceLine
                y={Number(minimo)}
                stroke="#e67e22"
                strokeDasharray="5 5"
                label={{
                  value: `Mín. ${minimo}`,
                  position: "insideTopLeft",
                  fontSize: 11,
                }}
              />
            )}

            {maximo !== undefined && maximo !== null && (
              <ReferenceLine
                y={Number(maximo)}
                stroke="#d64545"
                strokeDasharray="5 5"
                label={{
                  value: `Máx. ${maximo}`,
                  position: "insideTopLeft",
                  fontSize: 11,
                }}
              />
            )}

            <Line
              type="monotone"
              dataKey="valor"
              name={etiqueta}
              stroke="#2786d1"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="trend-chart-footer">
        <span>{datosValidos.length} mediciones</span>
        <span>
          {formatearFecha(datosValidos[0].fecha)}
          {" — "}
          {formatearFecha(datosValidos[datosValidos.length - 1].fecha)}
        </span>
      </div>
    </section>
  );
}
