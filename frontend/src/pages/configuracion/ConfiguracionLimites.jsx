import { useEffect, useState } from "react";
import { umbralesRepository } from "../../repositories/umbralesRepository";
import "./ConfiguracionLimites.css";

const VARIABLES = [
  { value: "temperatura", label: "Temperatura" },
  { value: "humedad", label: "Humedad" },
];

export default function ConfiguracionLimites() {
  const [incubadoraId, setIncubadoraId] = useState("");
  const [variable, setVariable] = useState("temperatura");
  const [minimo, setMinimo] = useState("");
  const [maximo, setMaximo] = useState("");

  const [incubadoras, setIncubadoras] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingIncubadoras, setLoadingIncubadoras] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const cargarIncubadoras = async () => {
      try {
        setLoadingIncubadoras(true);

        const data = await umbralesRepository.obtenerIncubadoras();

        setIncubadoras(data || []);
      } catch (err) {
        setError("No fue posible cargar las incubadoras.");
      } finally {
        setLoadingIncubadoras(false);
      }
    };

    cargarIncubadoras();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!incubadoraId || !variable || minimo === "" || maximo === "") {
      setError("Completa todos los campos.");
      return;
    }

    const minimoNumber = Number(minimo);
    const maximoNumber = Number(maximo);

    if (!Number.isFinite(minimoNumber) || !Number.isFinite(maximoNumber)) {
      setError("Los valores mínimo y máximo deben ser numéricos.");
      return;
    }

    if (minimoNumber >= maximoNumber) {
      setError("El valor mínimo debe ser menor que el valor máximo.");
      return;
    }

    try {
      setLoading(true);

      await umbralesRepository.guardarUmbral({
        incubadoraId,
        variable,
        minimo: minimoNumber,
        maximo: maximoNumber,
      });

      setSuccess("Los límites se guardaron correctamente.");

      setMinimo("");
      setMaximo("");
    } catch (err) {
      setError("No fue posible guardar los límites.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="configuracion-limites">
      <header className="configuracion-limites__header">
        <h1>Configuración de límites</h1>
        <p>
          Define los valores mínimo y máximo permitidos para cada variable de
          una incubadora.
        </p>
      </header>

      <form
        className="configuracion-limites__form"
        onSubmit={handleSubmit}
      >
        <div className="form-group">
          <label htmlFor="incubadora">Incubadora</label>

          <select
            id="incubadora"
            value={incubadoraId}
            onChange={(event) => setIncubadoraId(event.target.value)}
            disabled={loading || loadingIncubadoras}
          >
            <option value="">Selecciona una incubadora</option>

            {incubadoras.map((incubadora) => (
              <option key={incubadora.id} value={incubadora.id}>
                {incubadora.nombre || incubadora.id}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="variable">Variable</label>

          <select
            id="variable"
            value={variable}
            onChange={(event) => setVariable(event.target.value)}
            disabled={loading}
          >
            {VARIABLES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="minimo">Mínimo</label>

          <input
            id="minimo"
            type="number"
            value={minimo}
            onChange={(event) => setMinimo(event.target.value)}
            disabled={loading}
            step="any"
          />
        </div>

        <div className="form-group">
          <label htmlFor="maximo">Máximo</label>

          <input
            id="maximo"
            type="number"
            value={maximo}
            onChange={(event) => setMaximo(event.target.value)}
            disabled={loading}
            step="any"
          />
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {success && (
          <p className="form-success" role="status">
            {success}
          </p>
        )}

        <button type="submit" disabled={loading || loadingIncubadoras}>
          {loading ? "Guardando..." : "Guardar límites"}
        </button>
      </form>
    </section>
  );
}
