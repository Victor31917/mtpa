import AlertCard from "./AlertCard";
import "./AlertList.css";

function AlertList({ alertas = [] }) {
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
          />
        ))}
      </div>
    </section>
  );
}

export default AlertList;

