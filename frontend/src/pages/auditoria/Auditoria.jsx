
import { useCallback, useEffect, useState } from "react";
import auditoriaRepository from "../../repositories/auditoriaRepository";
import "./Auditoria.css";

const ETIQUETAS_EVENTO = {
  umbral_modificado: "Umbral modificado",
  alerta_reconocida: "Alerta reconocida",
  alerta_resuelta: "Alerta resuelta",
  configuracion_modificada: "Configuración modificada",
  reporte_exportado: "Reporte exportado",
  purga_historico: "Purga de histórico",
  dispositivo_creado: "Dispositivo creado",
  dispositivo_modificado: "Dispositivo modificado",
  usuario_creado: "Usuario creado",
  usuario_modificado: "Usuario modificado",
  usuario_eliminado: "Usuario eliminado",
  regla_automatizacion_guardada: "Regla de automatización guardada",
};

const TIPOS_EVENTO = Object.keys(ETIQUETAS_EVENTO);
const LIMITE_POR_PAGINA = 25;

function etiquetaEvento(tipo) {
  if (!tipo) return "Evento sin tipo";

  return (
    ETIQUETAS_EVENTO[tipo] ||
    tipo.replaceAll("_", " ").replace(/^./, (letra) => letra.toUpperCase())
  );
}

function formatearFecha(fecha) {
  if (!fecha) return "Fecha no disponible";

  const date =
    typeof fecha?.toDate === "function"
      ? fecha.toDate()
      : fecha instanceof Date
        ? fecha
        : new Date(fecha);

  if (Number.isNaN(date.getTime())) return "Fecha no disponible";

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

function resumirDetalle(detalle) {
  if (!detalle || typeof detalle !== "object") {
    return "Sin detalles";
  }

  const entradas = Object.entries(detalle);

  if (entradas.length === 0) return "Sin detalles";

  return entradas
    .slice(0, 3)
    .map(([campo, valor]) => {
      if (
        valor &&
        typeof valor === "object" &&
        ("antes" in valor || "despues" in valor)
      ) {
        return `${campo}: ${String(valor.antes ?? "—")} → ${String(
          valor.despues ?? "—"
        )}`;
      }

      const resumen =
        typeof valor === "object"
          ? JSON.stringify(valor)
          : String(valor ?? "—");

      return `${campo}: ${resumen}`;
    })
    .join(" · ");
}

function mensajeError(error) {
  const codigo = error?.code || "";

  if (
    codigo.includes("permission-denied") ||
    codigo.includes("unauthorized")
  ) {
    return "No tienes permisos para consultar los eventos de auditoría.";
  }

  return "No fue posible cargar la auditoría. Intenta nuevamente.";
}

export default function Auditoria() {
  const [tipoEvento, setTipoEvento] = useState("");
  const [eventos, setEventos] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState("");

  const cargarPrimeraPagina = useCallback(async () => {
    let cancelado = false;

    setCargando(true);
    setError("");
    setEventos([]);
    setCursor(null);
    setHayMas(false);

    try {
      const resultado = await auditoriaRepository.obtenerEventos({
        tipoEvento: tipoEvento || undefined,
        cursor: null,
        limite: LIMITE_POR_PAGINA,
      });

      if (cancelado) return;

      const lista = resultado.eventos || [];

      setEventos(lista);
      setCursor(resultado.cursorSiguiente ?? null);
      setHayMas(Boolean(resultado.cursorSiguiente));
    } catch (err) {
      if (!cancelado) setError(mensajeError(err));
    } finally {
      if (!cancelado) setCargando(false);
    }

    return () => {
      cancelado = true;
    };
  }, [tipoEvento]);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      setCargando(true);
      setError("");
      setEventos([]);
      setCursor(null);
      setHayMas(false);

      try {
        const resultado = await auditoriaRepository.obtenerEventos({
          tipoEvento: tipoEvento || undefined,
          cursor: null,
          limite: LIMITE_POR_PAGINA,
        });

        if (!activo) return;

        const lista = resultado.eventos || [];

        setEventos(lista);
        setCursor(resultado.cursorSiguiente ?? null);
        setHayMas(Boolean(resultado.cursorSiguiente));
      } catch (err) {
        if (activo) setError(mensajeError(err));
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargar();

    return () => {
      activo = false;
    };
  }, [tipoEvento]);

  async function cargarMas() {
    if (!cursor || cargandoMas || cargando) return;

    setCargandoMas(true);
    setError("");

    try {
      const resultado = await auditoriaRepository.obtenerEventos({
        tipoEvento: tipoEvento || undefined,
        cursor,
        limite: LIMITE_POR_PAGINA,
      });

      const nuevos = resultado.eventos || [];

      setEventos((actuales) => {
        const ids = new Set(actuales.map((evento) => evento.id));
        return [...actuales, ...nuevos.filter((evento) => !ids.has(evento.id))];
      });

      setCursor(resultado.cursorSiguiente ?? null);
      setHayMas(Boolean(resultado.cursorSiguiente));
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargandoMas(false);
    }
  }

  return (
    <section className="auditoria">
      <header className="auditoria__header">
        <div>
          <h1 className="auditoria__titulo">Auditoría</h1>
          <p className="auditoria__descripcion">
            Consulta los eventos y cambios registrados en el sistema.
          </p>
        </div>

        <label className="auditoria__filtro">
          <span>Tipo de evento</span>
          <select
            value={tipoEvento}
            onChange={(event) => setTipoEvento(event.target.value)}
          >
            <option value="">Todos los eventos</option>
            {TIPOS_EVENTO.map((tipo) => (
              <option key={tipo} value={tipo}>
                {etiquetaEvento(tipo)}
              </option>
            ))}
          </select>
        </label>
      </header>

      {error && (
        <div className="auditoria__error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => cargarPrimeraPagina()}
            disabled={cargando}
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="auditoria__tabla-contenedor">
        <table className="auditoria__tabla">
          <thead>
            <tr>
              <th scope="col">Fecha y hora</th>
              <th scope="col">Tipo de evento</th>
              <th scope="col">Usuario</th>
              <th scope="col">Entidad afectada</th>
              <th scope="col">Detalle</th>
            </tr>
          </thead>

          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={5} className="auditoria__estado">
                  Cargando eventos de auditoría…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="auditoria__estado">
                  No se pudieron mostrar los eventos.
                </td>
              </tr>
            ) : eventos.length === 0 ? (
              <tr>
                <td colSpan={5} className="auditoria__estado">
                  No hay eventos para mostrar.
                </td>
              </tr>
            ) : (
              eventos.map((evento) => (
                <tr key={evento.id}>
                  <td className="auditoria__fecha">
                    {formatearFecha(evento.fecha)}
                  </td>
                  <td>{etiquetaEvento(evento.tipoEvento)}</td>
                  <td>
                    {evento.usuarioId === "sistema"
                      ? "Sistema"
                      : evento.usuarioId || "Desconocido"}
                  </td>
                  <td className="auditoria__entidad">
                    {evento.entidadAfectada || "—"}
                  </td>
                  <td className="auditoria__detalle">
                    {resumirDetalle(evento.detalle)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!cargando && !error && eventos.length > 0 && hayMas && (
        <div className="auditoria__acciones">
          <button
            type="button"
            onClick={cargarMas}
            disabled={cargandoMas}
          >
            {cargandoMas ? "Cargando…" : "Cargar más"}
          </button>
        </div>
      )}
    </section>
  );
}
