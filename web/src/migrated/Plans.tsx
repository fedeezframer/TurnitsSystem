import * as React from "react"


const defaults = [
    { id: "gratis", nombre: "Gratis", precio_mensual: 0 },
    { id: "basico", nombre: "Básico", precio_mensual: 19900 },
    { id: "premium", nombre: "Premium", precio_mensual: 49900 },
]
const descriptions = ["Para empezar a recibir turnos", "Para independientes y equipos chicos", "Para negocios con equipos más grandes"]
const rows = [
    ["Profesionales por cuenta", "1: el titular", "3: titular + 2 miembros", "Sin límite"],
    ["Servicios y productos", "Ilimitados", "Ilimitados", "Ilimitados"],
    ["Agenda y recordatorios", true, true, true],
    ["Clientes visibles en el listado", "Hasta 10", "Hasta 50", "Ilimitados"],
    ["Estadísticas del negocio", "Resumen de actividad", "Métricas completas", "Métricas completas"],
    ["Mercado Pago", "Tarjetas aceptadas y saldo", "Tarjetas aceptadas y saldo", "Tarjetas aceptadas y saldo"],
    ["Transferencia y efectivo", false, false, true],
    ["Cobro por reserva", "Total y seña", "Total y seña", "Total, seña y sin cobro"],
    ["Comisión Turnits por cobro online", "$300 o 2%, el mayor", "$100 o 0,8%, el mayor", "Sin comisión Turnits"],
    ["Logo del negocio", true, true, true],
    ["Personalización de temas", false, true, true],
    ["Combos y promociones", false, true, true],
    ["Finanzas y gastos", true, true, true],
    ["Acceso individual del equipo", false, true, true],
    ["Rendimiento por integrante", false, true, true],
    ["Sucursales", "No", "No", "Próximamente"],
    ["Soporte", "Lista de espera", "Lista de espera", "Prioritario"],
]
function Value({ value, color }) {
    if (typeof value !== "boolean") return <span>{value}</span>
    return value ? <span aria-label="Incluido" style={{ display: "inline-flex", color }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg></span> : <span aria-label="No incluido" style={{ color: "#9CA3AF" }}>—</span>
}

/** @framerSupportedLayoutWidth any */
/** @framerSupportedLayoutHeight auto */
export default function PlanesTurnits(props) {
    const { baseUrl = "https://negosocio.onrender.com", registroUrl = "/registro", accentColor = "#1B6B1A", style } = props
    const [catalog, setCatalog] = React.useState(defaults)
    const [days, setDays] = React.useState(30)
    const isCanvas = false
    React.useEffect(() => {
        if (isCanvas) return
        const controller = new AbortController()
        fetch(baseUrl.replace(/\/+$/, "") + "/planes", { signal: controller.signal }).then(r => {
            if (!r.ok) throw Error("planes")
            return r.json()
        }).then(data => {
            if (!data.success || !Array.isArray(data.planes)) return
            const valid = defaults.map(p => data.planes.find(candidate => candidate.id === p.id && Number.isFinite(candidate.precio_mensual) && candidate.precio_mensual >= 0) || p)
            setCatalog(valid)
            if (Number.isInteger(data.dias_prueba_basico) && data.dias_prueba_basico > 0) setDays(data.dias_prueba_basico)
        }).catch(() => {})
        return () => controller.abort()
    }, [baseUrl, isCanvas])
    const price = p => "$" + p.precio_mensual.toLocaleString("es-AR")
    const href = id => registroUrl + (registroUrl.includes("?") ? "&" : "?") + "plan=" + id
    const cta = (p, i) => <a className="tp-cta" href={href(p.id)} style={{ background: i === 1 ? accentColor : "white", color: i === 1 ? "white" : accentColor, border: "1px solid " + accentColor }}>{i === 0 ? "Empezar gratis" : i === 1 ? "Probar Básico" : "Probar Premium"}</a>
    return <section className="tp-root" style={{ ...style, width: "100%", height: "auto", color: "#111827", fontFamily: "inherit", "--tp-accent": accentColor } as React.CSSProperties}>
        <style>{`
            .tp-root,.tp-root *{box-sizing:border-box}
            .tp-root{container-type:inline-size;background:#FAFBFC;padding:48px 24px}
            .tp-content{max-width:1180px;margin:0 auto}
            .tp-heading{text-align:center;margin:0 0 12px;font-size:clamp(28px,4vw,40px);letter-spacing:-1px;line-height:1.15}
            .tp-subtitle{text-align:center;color:#667085;font-size:15px;line-height:1.6;margin:0 auto 36px;max-width:600px}
            .tp-table{width:100%;table-layout:fixed;border-collapse:separate;border-spacing:0;border:1px solid #E5E9EF;border-radius:20px;overflow:hidden;background:white}
            .tp-table th,.tp-table td{padding:18px 16px;border-bottom:1px solid #EDF0F4;font-size:13px;line-height:1.55;vertical-align:middle;text-align:center}
            .tp-table th:first-child,.tp-table td:first-child{text-align:left;width:28%;color:#475467}
            .tp-table thead th{padding-top:28px;padding-bottom:28px;font-weight:400;vertical-align:top}
            .tp-table th:nth-child(3),.tp-table td:nth-child(3){background:#F5FAF5}
            .tp-table tbody tr:last-child td{border-bottom:none}
            .tp-name{font-size:20px;font-weight:700;margin-bottom:8px;color:#111827}
            .tp-price{font-size:29px;font-weight:750;letter-spacing:-1px;color:#111827;white-space:nowrap}
            .tp-price small{font-size:12px;font-weight:400;color:#667085;letter-spacing:0}
            .tp-desc{color:#667085;font-size:12px;min-height:40px;margin:10px 0 18px;line-height:1.5}
            .tp-cta{display:flex;align-items:center;justify-content:center;text-align:center;min-height:42px;border-radius:9px;text-decoration:none;font-size:13px;font-weight:600;padding:10px 12px;transition:transform .2s,box-shadow .2s}
            .tp-cta:hover{transform:translateY(-2px);box-shadow:0 4px 12px #10182812}
            .tp-cta:focus-visible{outline:3px solid var(--tp-accent);outline-offset:3px}
            .tp-note{font-size:12px;line-height:1.7;color:#667085;text-align:center;margin:22px auto 0;max-width:820px}
            .tp-mobile{display:none}
            @container (max-width:760px){
                .tp-table{display:none}.tp-mobile{display:grid;gap:18px}
                .tp-card{background:white;border:1px solid #E5E9EF;border-radius:18px;padding:24px}
                .tp-card:nth-child(2){border-color:var(--tp-accent);background:#F5FAF5}
                .tp-item{display:flex;justify-content:space-between;gap:20px;align-items:center;padding:12px 0;border-bottom:1px solid #EDF0F4;font-size:12px;line-height:1.5}
                .tp-item>span:first-child{color:#667085;flex:1}.tp-item>span:last-child{text-align:right;flex:1}
            }
            @media(prefers-reduced-motion:reduce){.tp-cta{transition:none}}
        `}</style>
        <div className="tp-content">
            <h1 className="tp-heading">Planes y precios</h1>
            <p className="tp-subtitle">Elegí el plan que acompaña el tamaño de tu negocio. Todos incluyen tu agenda online y reservas para tus clientes.</p>
            <table className="tp-table" aria-label="Comparación de planes Turnits">
                <thead><tr><th scope="col">Beneficios y funciones</th>{catalog.map((p, i) => <th scope="col" key={p.id}>
                    <div className="tp-name">Plan {p.nombre}</div><div className="tp-price">{price(p)} <small>ARS{p.id !== "gratis" && "/mes"}</small></div>
                    <p className="tp-desc">{descriptions[i]}</p>{cta(p, i)}
                </th>)}</tr></thead>
                <tbody>{rows.map(row => <tr key={String(row[0])}><td>{row[0]}</td>{catalog.map((p, i) => <td key={p.id}><Value value={row[i + 1]} color={accentColor} /></td>)}</tr>)}</tbody>
            </table>
            <div className="tp-mobile">{catalog.map((p, i) => <article className="tp-card" key={p.id}>
                <h2 className="tp-name">Plan {p.nombre}</h2><div className="tp-price">{price(p)} <small>ARS{p.id !== "gratis" && "/mes"}</small></div>
                <p className="tp-desc">{descriptions[i]}</p>{cta(p, i)}
                <div style={{ marginTop: 18 }}>{rows.map(row => <div className="tp-item" key={String(row[0])}><span>{row[0]}</span><span><Value value={row[i + 1]} color={accentColor} /></span></div>)}</div>
            </article>)}</div>
            <p className="tp-note">Básico y Premium incluyen {days} días de prueba con las funciones de cada plan. Durante cualquier prueba, el fee por cobro online es el de Gratis: el mayor entre $300 y 2%. Después se aplica la comisión del plan elegido. Mercado Pago cobra sus propias comisiones por separado.</p>
        </div>
    </section>
}

