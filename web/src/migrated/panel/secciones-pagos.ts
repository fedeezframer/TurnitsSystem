export const seccionesPagos = [
    { id: "metodos", titulo: "Medios de pago", icono: "/assets/panel-nav/fluent_payment-wireless-28-regular.svg", descripcion: "Administrá tus cuentas y los medios de pago disponibles para tus clientes." },
    { id: "tipo", titulo: "Tipo de cobro", icono: "/assets/panel-nav/iconmind_union-type-outline-regular.svg", descripcion: "Elegí cómo se confirma una reserva en tu agenda." },
    { id: "costos", titulo: "Calcular costos", icono: "/assets/panel-nav/famicons_calculator-sharp.svg", descripcion: "Calculá cuánto recibís o cuánto cobrar con cada método de pago." },
] as const
export type VistaPagos = typeof seccionesPagos[number]["id"]
