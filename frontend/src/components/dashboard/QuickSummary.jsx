import { STATUS } from "../../utils/constants";
import "./QuickSummary.css";

const ESTADOS = [
  { clave: STATUS.NORMAL, etiqueta: "Normal" },
  { clave: STATUS.WARNING, etiqueta: "Advertencia" },
  { clave: STATUS.CRITICAL, etiqueta: "Crítico" },
];

const ETIQUETAS = Object.fromEntries(
  ESTADOS.map(({ clave, etiqueta }) => [clave, etiqueta])
);

// Props:
// - incubadoras: lista de { id, nombre, estadoGeneral } donde
//   estadoGeneral es "normal", "advertencia" o "critico"
const QuickSummary = ({ incubadoras = [] }) => {
  const contar = (clave) =>
    incubadoras.filter((incubadora) => incubadora.estadoGeneral === clave)
      .length;

  return (
    <section className="quick-summary" aria-label="Resumen de incubadoras">
      <div className="quick-summary__totales">
        <div className="quick-summary__total">
          <strong className="quick-summary__numero">
            {incubadoras.length}
          </strong>
          <span className="quick-summary__etiqueta">
            {incubadoras.length === 1 ? "Incubadora" : "Incubadoras"}
          </span>
        </div>

        {ESTADOS.map(({ clave, etiqueta }) => (
          <div
            key={clave}
            className={`quick-summary__total quick-summary__total--${clave}`}
          >
            <strong className="quick-summary__numero">{contar(clave)}</strong>
            <span className="quick-summary__etiqueta">{etiqueta}</span>
          </div>
        ))}
      </div>

      {incubadoras.length > 0 && (
        <ul className="quick-summary__lista">
          {incubadoras.map((incubadora) => (
            <li key={incubadora.id} className="quick-summary__fila">
              <span className="quick-summary__nombre">
                {incubadora.nombre || incubadora.id}
              </span>

              <span
                className={`quick-summary__estado quick-summary__estado--${incubadora.estadoGeneral}`}
              >
                {ETIQUETAS[incubadora.estadoGeneral] || "Sin datos"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default QuickSummary;
