# HU-28 — Ver la rendición por profesional

**Incremento:** 3 · **Actividad:** Gestión de pagos

> Como gerente, necesito ver cuántos pacientes atendió cada profesional, cuánto dinero entró por sus turnos y la comisión del centro, para rendirle cuentas sin hacer cálculos a mano.

## Datos

Por profesional y período:

- **Producido:** pacientes atendidos (turnos Completados), sin distinguir particulares de obra social. Con el detalle por servicio y por cobertura.
- **Cobrado:** el dinero que entró al centro por sus turnos, es decir, los cobros vigentes a pacientes particulares. Con el detalle por medio de pago.
- **Comisión del centro:** 15 % de lo cobrado, por el uso de las instalaciones.
- **Neto del profesional:** cobrado menos comisión.
- Totales del centro: atendidos, cobrado y comisiones.

## Validaciones

- El período es un mes o un rango de días, de hasta tres meses. Por defecto, el mes en curso.
- Un turno pertenece al período por su fecha, y su cobro también: así la rendición de un mes no cambia porque un turno se cobró al mes siguiente.
- La comisión se calcula con dos decimales y redondeo al centavo.

## Comportamiento

- Pantalla **Rendiciones**: tabla de todos los profesionales con producido, cobrado, comisión y neto; al elegir uno se ve el detalle por servicio y por cobertura, y la lista de turnos con su cobro.
- Se imprime o se guarda como PDF desde el navegador.
- Usa la misma lectura de cobros que la caja ([HU-27](HU-27-cierre-de-caja.md)).

## Permisos

- `MANAGER`: ve la rendición de todos.
- `PROFESSIONAL`: ve solo la suya. La DAL aplica el filtro.
- `RECEPTIONIST`: sin acceso.

## Operaciones

- `getProfessionalStatement` — nueva, de lectura.

## A conversar

- Devolución del Inc. 2 (general): "rendiciones o cierre de caja por profesional".
- **Decisión del equipo (05/10/2026):** lo producido es la cantidad de pacientes que atiende un profesional, sin importar si paga particular o por obra social. Lo cobrado es la plata que entra al centro: lo que pagan los pacientes particulares. Al profesional se le resta una comisión del 15 % por el uso de las instalaciones.
- ¿La comisión se calcula solo sobre lo cobrado a particulares, o también sobre las prestaciones de obra social cuando la obra social le pague al centro? **Supuesto del equipo:** solo sobre lo cobrado, porque lo que paga la obra social no pasa por el sistema.
- ¿El 15 % es igual para todos los profesionales y fijo? **Supuesto del equipo:** sí, como valor del centro en la configuración.
- [`contexto-goat.md`](../contexto-goat.md) deja fuera la liquidación de honorarios y sueldos. La comisión es un cálculo informativo sobre lo cobrado, sin pagos, retenciones ni recibos al profesional.
