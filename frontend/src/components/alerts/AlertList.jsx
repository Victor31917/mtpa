import AlertCard from "./AlertCard";
import "./AlertList.css";

// Props:
// - alertas: lista de alertas a mostrar
// - onSelect (opcional): se invoca con la alerta al pulsar una tarjeta
function AlertList({ alertas = [], onSelect }) {
  if (alertas.length === 0) {
    return (
      <div className="alert-list__empty">
        <p>No tienes alertas por el momento.</p>
      </div>
    );
  }

  return (
    <section className="alert-list">
      <div className="alert-list__items">
        {alertas.map((alerta) => (
          <AlertCard
            key={alerta.id}
            alerta={alerta}
            onClick={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

export default AlertList;

