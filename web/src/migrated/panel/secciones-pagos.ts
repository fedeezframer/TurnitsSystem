export const seccionesPagos = [
    { id: "costos", titulo: "Calcular costos", icono: "/assets/panel-nav/ion_stats-chart-sharp.svg", descripcion: "Calculá cuánto recibís o cuánto cobrar con cada método de pago." },
    { id: "tipo", titulo: "Tipo de cobro", icono: "/assets/panel-nav/hugeicons_sale-tag-01.svg", descripcion: "Elegí cómo se confirma una reserva en tu agenda." },
    { id: "metodos", titulo: "Métodos de pago", icono: "/assets/panel-nav/ix_money-alt.svg", descripcion: "Administrá tus cuentas y los medios de pago disponibles para tus clientes." },
] as const
export type VistaPagos = typeof seccionesPagos[number]["id"]
