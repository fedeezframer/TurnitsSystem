export interface Membership {
  id: string
  nombre: string
  descripcion: string
  precio_mensual: number
  precio_original?: number
  profesionales?: string[]
  servicios: string[]
  servicios_incluidos?: { nombre: string; cantidad: number }[]
  imagen_url?: string | null
  productos: string[]
  productos_incluidos?: { nombre: string; cantidad: number }[]
}

const money = (value: number) => `$${Number(value || 0).toLocaleString("es-AR")}`

export function MembershipCatalog({ plans }: { plans: Membership[] }) {
  return (
    <div className="bl-promo-grid">
      {plans.map(plan => {
        const included = plan.servicios_incluidos || plan.servicios.map(nombre => ({ nombre, cantidad: 1 }))
        const products = plan.productos_incluidos || plan.productos.map(nombre => ({ nombre, cantidad: 1 }))
        const total = included.reduce((sum, service) => sum + service.cantidad, 0)
        return <article key={plan.id} className="bl-promo">
          {plan.imagen_url && <div className="bl-promo-img"><img src={plan.imagen_url} alt="" loading="lazy" /></div>}
          <div className="bl-promo-body" style={{ overflowWrap: "anywhere" }}>
            <strong>{plan.nombre}</strong>
            <div className="bl-promo-price"><b>{money(plan.precio_mensual)}</b><span>/ mes</span>{Number(plan.precio_original) > plan.precio_mensual && <s>{money(Number(plan.precio_original))}</s>}</div>
            {!!plan.profesionales?.length && <p style={{ margin: 0 }}><b>Profesionales</b> · {plan.profesionales.join(", ")}</p>}
            {plan.descripcion && <p style={{ margin: 0 }}>{plan.descripcion}</p>}
            {total > 0 && <div>
              <b>{total} {total === 1 ? "servicio" : "servicios"} al mes</b>
              <ul style={{ paddingLeft: 19, margin: "4px 0" }}>{included.map(({ nombre, cantidad }, index) => <li key={index}>{cantidad} × {nombre}</li>)}</ul>
            </div>}
            {products.length > 0 && <div>
              <b>Productos</b>
              <ul style={{ paddingLeft: 19, margin: "4px 0" }}>{products.map(({ nombre, cantidad }, index) => <li key={index}>{cantidad} × {nombre}</li>)}</ul>
            </div>}
          </div>
        </article>
      })}
    </div>
  )
}
