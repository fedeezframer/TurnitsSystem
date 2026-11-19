export type Regla = { minima: number, tasa: number, mediosOffline: boolean }
export function costos(valor: number, inverso: boolean, regla: Regla, tasaMP: number) {
    const objetivo = Math.round(valor * 100)
    const cargos = (centavos: number) => ({
        turnits: 100 * Math.max(regla.minima, Math.round(centavos / 100 * regla.tasa)),
        mp: Math.round(centavos * tasaMP),
    })
    let bruto = objetivo
    if (inverso) {
        // Punto fijo en centavos. Los dos cargos son crecientes, también al cruzar el mínimo.
        for (;;) {
            const { turnits, mp } = cargos(bruto)
            const siguiente = objetivo + turnits + mp
            if (siguiente === bruto) break
            bruto = siguiente
        }
    }
    const { turnits, mp } = cargos(bruto)
    return { resultado: (inverso ? bruto : bruto - turnits - mp) / 100, mp: mp / 100, turnits: turnits / 100 }
}
