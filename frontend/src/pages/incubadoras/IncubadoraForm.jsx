```jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import incubadorasRepository from "../../repositories/incubadorasRepository";
import "./IncubadoraForm.css";

const IncubadoraForm = () => {
  const navigate = useNavigate();

  const [formulario, setFormulario] = useState({
    nombre: "",
    ubicacion: "",
    estado: "activa",
  });

  const [dispositivo, setDispositivo] = useState({
    tipo: "",
  });

  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormulario((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleDispositivoChange = (e) => {
    const { name, value } = e.target;

    setDispositivo((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validarFormulario = () => {
    if (!formulario.nombre.trim()) {
      return "El nombre de la incubadora es obligatorio.";
    }

    if (!formulario.ubicacion.trim()) {
      return "La ubicación de la incubadora es obligatoria.";
    }

    if (!formulario.estado) {
      return "El estado de la incubadora es obligatorio.";
    }

    if (!["activa", "inactiva"].includes(formulario.estado)) {
      return "El estado seleccionado no es válido.";
    }

    if (dispositivo.tipo && ![
      "sensor_temperatura",
      "sensor_humedad",
      "ventilador",
    ].includes(dispositivo.tipo)) {
      return "El tipo de dispositivo seleccionado no es válido.";
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const mensajeError = validarFormulario();

    if (mensajeError) {
      setError(mensajeError);
      return;
    }

    try {
      setCargando(true);
      setError("");

      /*
       * Se envía la incubadora junto con el dispositivo,
       * si el usuario decidió registrar uno.
       */
      await incubadorasRepository.gestionarIncubadora({
        ...formulario,
        dispositivo: dispositivo.tipo
          ? {
              tipo: dispositivo.tipo,
            }
          : null,
      });

      navigate("/incubadoras");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "No se pudo guardar la información de la incubadora."
      );
    } finally {
      setCargando(false);
    }
  };

  const handleCancelar = () => {
    navigate("/incubadoras");
  };

  return (
    <div className="incubadora-form-page">
      <div className="incubadora-form-container">
        <div className="incubadora-form-header">
          <h1>Registrar incubadora</h1>
          <p>
            Complete la información de la incubadora y, si corresponde,
            registre un dispositivo asociado.
          </p>
        </div>

        {error && (
          <div className="incubadora-form-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <section className="form-section">
            <h2>Información de la incubadora</h2>

            <div className="form-group">
              <label htmlFor="nombre">
                Nombre <span>*</span>
              </label>

              <input
                id="nombre"
                name="nombre"
                type="text"
                value={formulario.nombre}
                onChange={handleChange}
                placeholder="Ingrese el nombre de la incubadora"
                disabled={cargando}
              />
            </div>

            <div className="form-group">
              <label htmlFor="ubicacion">
                Ubicación <span>*</span>
              </label>

              <input
                id="ubicacion"
                name="ubicacion"
                type="text"
                value={formulario.ubicacion}
                onChange={handleChange}
                placeholder="Ingrese la ubicación"
                disabled={cargando}
              />
            </div>

            <div className="form-group">
              <label htmlFor="estado">
                Estado <span>*</span>
              </label>

              <select
                id="estado"
                name="estado"
                value={formulario.estado}
                onChange={handleChange}
                disabled={cargando}
              >
                <option value="activa">activa</option>
                <option value="inactiva">inactiva</option>
              </select>
            </div>
          </section>

          <section className="form-section">
            <h2>Dar de alta un dispositivo</h2>

            <p className="section-description">
              Seleccione un dispositivo para asociarlo a esta incubadora.
              Este campo es opcional.
            </p>

            <div className="form-group">
              <label htmlFor="tipo">
                Tipo de dispositivo
              </label>

              <select
                id="tipo"
                name="tipo"
                value={dispositivo.tipo}
                onChange={handleDispositivoChange}
                disabled={cargando}
              >
                <option value="">No registrar dispositivo</option>
                <option value="sensor_temperatura">
                  sensor_temperatura
                </option>
                <option value="sensor_humedad">
                  sensor_humedad
                </option>
                <option value="ventilador">
                  ventilador
                </option>
              </select>
            </div>
          </section>

          <div className="incubadora-form-actions">
            <button
              type="button"
              className="btn-cancelar"
              onClick={handleCancelar}
              disabled={cargando}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="btn-guardar"
              disabled={cargando}
            >
              {cargando ? "Guardando..." : "Guardar incubadora"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IncubadoraForm;
```
