# Plan de pruebas de automatización

**Archivo:** `docs/pruebas/plan-pruebas-automatizacion.md`

## 1. Objetivo

Validar el funcionamiento de las reglas automáticas del ventilador, la histéresis, la creación y ejecución de órdenes, la prevención de duplicados y el manejo de errores del simulador.

## 2. Requisitos previos

- Tener configurada una regla automática con `umbralActivacion` y `margenHisteresis`.
- Disponer de un ventilador con `estadoActual`, `modo` y una regla con `activa`.
- Poder consultar las órdenes creadas y sus estados.
- Tener disponible el servicio que procesa las mediciones.
- Contar con Jest para ejecutar las pruebas automatizadas.

Instalación, si el proyecto utiliza npm y todavía no tiene Jest:

```bash
npm install --save-dev jest
```

Agregar al `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:automatizacion": "jest tests/automatizacion"
  }
}
```

Ajusta las rutas a la estructura real del proyecto.

## 3. Configuración de referencia

Para los ejemplos se utilizan estos valores:

```js
const regla = {
  activa: true,
  umbralActivacion: 30,
  margenHisteresis: 5
};

const ventilador = {
  modo: "automatico",
  estadoActual: "apagado"
};
```

Interpretación de los umbrales:

- Valor mayor o igual a `30`: activar el ventilador si está apagado.
- Valor menor o igual a `25`: apagarlo si está encendido.
- Valor entre ambos umbrales: conservar el estado actual.

**Importante:** esta interpretación supone que la regla activa el ventilador cuando aumenta la medición. Si la aplicación utiliza otra convención, adapta los valores y las condiciones.

## 4. Casos de prueba

| ID | Escenario | Resultado esperado |
|---|---|---|
| PA-01 | La medición alcanza el umbral de activación | Se crea una orden automática de encender, termina en `ejecutada` y el estado queda en `encendido`. |
| PA-02 | La medición baja, pero permanece dentro del margen de histéresis | No se crea una orden y el ventilador conserva su estado. |
| PA-03 | La medición baja hasta el umbral de apagado o por debajo de él | Se crea una orden automática de apagar. |
| PA-04 | Hay una orden en curso o el estado actual ya coincide con el deseado | No se crean órdenes duplicadas ni órdenes innecesarias. |
| PA-05 | El ventilador está en modo `manual`, la regla está inactiva o el modo es `mixto` | En manual o con la regla inactiva no se crean órdenes automáticas. En mixto se conserva la convivencia con las órdenes manuales. |
| PA-06 | El simulador está detenido | La orden automática termina en `fallida`, queda registrada y el procesamiento de mediciones continúa. |

## 5. Código de pruebas con Jest

Crea, por ejemplo, el archivo `tests/automatizacion/automatizacion.test.js`.

El siguiente código define el contrato esperado del servicio `procesarMedicion`. Debes adaptar el import, los nombres de las propiedades y los métodos simulados a la implementación real de tu proyecto.

```js
const {
  procesarMedicion
} = require("../../src/services/automatizacion");

describe("Automatización del ventilador", () => {
  let ventilador;
  let regla;
  let dependencias;

  beforeEach(() => {
    ventilador = {
      id: "ventilador-1",
      modo: "automatico",
      estadoActual: "apagado"
    };

    regla = {
      activa: true,
      umbralActivacion: 30,
      margenHisteresis: 5
    };

    dependencias = {
      crearOrden: jest.fn(async (orden) => ({
        id: "orden-1",
        ...orden,
        estado: "pendiente"
      })),

      obtenerOrdenEnCurso: jest.fn(async () => null),

      ejecutarOrden: jest.fn(async (orden) => ({
        ...orden,
        estado: "ejecutada"
      })),

      actualizarEstadoVentilador: jest.fn(async (estado) => {
        ventilador.estadoActual = estado;
      }),

      registrarError: jest.fn(async () => {})
    };
  });

  test("PA-01: activa el ventilador al alcanzar el umbral", async () => {
    dependencias.ejecutarOrden.mockImplementationOnce(
      async (orden) => {
        ventilador.estadoActual = "encendido";

        return {
          ...orden,
          estado: "ejecutada"
        };
      }
    );

    await procesarMedicion({
      valor: 30,
      ventilador,
      regla,
      dependencias
    });

    expect(dependencias.crearOrden).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "automatico",
        accion: "encender"
      })
    );

    expect(dependencias.ejecutarOrden).toHaveBeenCalled();

    expect(ventilador.estadoActual).toBe("encendido");
  });

  test("PA-02: conserva el estado dentro del margen de histéresis", async () => {
    ventilador.estadoActual = "encendido";

    await procesarMedicion({
      valor: 28,
      ventilador,
      regla,
      dependencias
    });

    expect(dependencias.crearOrden).not.toHaveBeenCalled();
    expect(ventilador.estadoActual).toBe("encendido");
  });

  test("PA-03: solicita apagar por debajo del umbral de apagado", async () => {
    ventilador.estadoActual = "encendido";

    dependencias.ejecutarOrden.mockImplementationOnce(
      async (orden) => {
        ventilador.estadoActual = "apagado";

        return {
          ...orden,
          estado: "ejecutada"
        };
      }
    );

    await procesarMedicion({
      valor: 24,
      ventilador,
      regla,
      dependencias
    });

    expect(dependencias.crearOrden).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "automatico",
        accion: "apagar"
      })
    );

    expect(ventilador.estadoActual).toBe("apagado");
  });

  test("PA-04: no duplica órdenes en curso ni repite órdenes innecesarias", async () => {
    dependencias.obtenerOrdenEnCurso.mockResolvedValue({
      id: "orden-existente",
      tipo: "automatico",
      accion: "encender",
      estado: "en_curso"
    });

    await procesarMedicion({
      valor: 35,
      ventilador,
      regla,
      dependencias
    });

    expect(dependencias.crearOrden).not.toHaveBeenCalled();

    dependencias.obtenerOrdenEnCurso.mockResolvedValue(null);
    ventilador.estadoActual = "encendido";

    await procesarMedicion({
      valor: 35,
      ventilador,
      regla,
      dependencias
    });

    expect(dependencias.crearOrden).not.toHaveBeenCalled();
  });

  test("PA-05: respeta los modos manual, automático y mixto", async () => {
    ventilador.modo = "manual";

    await procesarMedicion({
      valor: 35,
      ventilador,
      regla,
      dependencias
    });

    expect(dependencias.crearOrden).not.toHaveBeenCalled();

    ventilador.modo = "automatico";
    regla.activa = false;

    await procesarMedicion({
      valor: 35,
      ventilador,
      regla,
      dependencias
    });

    expect(dependencias.crearOrden).not.toHaveBeenCalled();

    regla.activa = true;
    ventilador.modo = "mixto";

    await procesarMedicion({
      valor: 35,
      ventilador,
      regla,
      dependencias
    });

    expect(dependencias.crearOrden).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "automatico",
        accion: "encender"
      })
    );
  });

  test("PA-06: registra el fallo del simulador y continúa procesando", async () => {
    const errorSimulador = new Error("Simulador detenido");

    dependencias.ejecutarOrden.mockRejectedValueOnce(errorSimulador);

    await expect(
      procesarMedicion({
        valor: 35,
        ventilador,
        regla,
        dependencias
      })
    ).resolves.not.toThrow();

    expect(dependencias.registrarError).toHaveBeenCalled();

    // La orden fallida debe quedar registrada con estado "fallida".
    // La implementación real debe persistir ese estado antes de continuar.

    // Una medición posterior debe poder procesarse.
    dependencias.ejecutarOrden.mockResolvedValueOnce({
      id: "orden-2",
      estado: "ejecutada"
    });

    await expect(
      procesarMedicion({
        valor: 36,
        ventilador,
        regla,
        dependencias
      })
    ).resolves.not.toThrow();
  });
});
```

### Consideraciones para adaptar el código

1. El servicio debe comprobar el modo y la regla antes de crear una orden.
2. La comprobación de órdenes en curso debe ejecutarse antes de crear una nueva orden.
3. El estado del ventilador solo debe actualizarse cuando la ejecución se confirme como exitosa.
4. Los errores del simulador deben capturarse y registrarse sin bloquear las siguientes mediciones.
5. Si la regla está en modo `mixto`, el servicio debe aplicar la política definida por el proyecto para permitir órdenes automáticas y manuales sin conflictos.
6. La orden debe persistirse con estado `fallida` cuando la ejecución no pueda completarse.

**Nota:** los ejemplos son una plantilla de pruebas; no se garantiza que pasen hasta adaptar el contrato y las dependencias al código real.

## 6. Ejecución de las pruebas

Ejecutar únicamente las pruebas de automatización:

```bash
npm run test:automatizacion
```

Ejecutar toda la suite:

```bash
npm test
```

Ejecutar con información detallada:

```bash
npx jest tests/automatizacion/automatizacion.test.js --runInBand --verbose
```

## 7. Criterios de aceptación

- [ ] PA-01: la orden de encender termina en `ejecutada`.
- [ ] PA-02: la histéresis evita cambios innecesarios.
- [ ] PA-03: se genera la orden de apagar cuando corresponde.
- [ ] PA-04: no existen órdenes automáticas duplicadas.
- [ ] PA-05: se respetan los modos y el estado de activación de la regla.
- [ ] PA-06: los fallos del simulador se registran y no interrumpen el procesamiento.
- [ ] Todas las pruebas automatizadas finalizan correctamente.

## 8. Resultado de la ejecución

Completar después de ejecutar las pruebas:

| Campo | Resultado |
|---|---|
| Fecha | Pendiente |
| Total de pruebas | Pendiente |
| Pruebas aprobadas | Pendiente |
| Pruebas fallidas | Pendiente |
| Observaciones | Pendiente |

**Conclusión:** el plan se considerará aprobado cuando todos los casos pasen y se verifique que los estados de las órdenes y del ventilador coincidan con los resultados esperados.
