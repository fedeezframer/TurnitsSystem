export type MembershipTickets = {
    id: string
    membresia_id: string | null
    nombre: string
    servicios: Record<string, number>
    productos: Record<string, number>
    profesional_ids: string[]
    vence_at: string
}

export function ticketCount(items: Record<string, number>) {
    return Object.values(items).reduce((sum, amount) => sum + amount, 0)
}

export async function fetchMembershipTickets(api: string, slug: string, authorization: string, signal?: AbortSignal): Promise<MembershipTickets[]> {
    const response = await fetch(`${api}/membresias/${encodeURIComponent(slug)}/tickets`, { headers: { Authorization: authorization }, signal, cache: "no-store" })
    const result = await response.json()
    if (!response.ok || !result.success) throw new Error(result.error || "No pudimos consultar tus tickets.")
    return result.planes
}
