import React from "react"
import PublicOverlay from "./PublicOverlay"
import type { MapBranch } from "./BranchMap"
import { validPoint } from "../shared/locations.js"

const BranchMap = React.lazy(() => import("./BranchMap").then(module => ({ default: module.BranchMap })))

export default function BusinessLocations({ branches, onClose }: { branches: MapBranch[]; onClose: () => void }) {
    const [selected, setSelected] = React.useState("")
    const pins = branches.filter(validPoint).map(({ id, nombre, latitud, longitud }) => ({ id, nombre, latitud, longitud }))
    return <PublicOverlay title="Ubicaciones" onClose={onClose}>
        {pins.length > 0 && <React.Suspense fallback={<p role="status">Cargando mapa…</p>}>
            <BranchMap pins={pins} selected={selected} onSelect={setSelected} />
        </React.Suspense>}
        <ul style={{ margin: "16px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
            {branches.map(branch => {
                const pin = pins.find(item => item.id === branch.id)
                const query = pin ? `${pin.latitud},${pin.longitud}` : branch.direccion
                return <li key={branch.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
                    gap: 10, border: "1px solid #dce6dd", borderRadius: 12, padding: "10px 12px",
                    background: selected === branch.id ? "#edf5ed" : "white" }}>
                    <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                        {pin ? <button type="button" aria-pressed={selected === branch.id} onClick={() => setSelected(branch.id)}
                            style={{ border: 0, padding: 0, background: "transparent", color: "inherit", cursor: "pointer", fontWeight: 700 }}>{branch.nombre}</button> : <strong>{branch.nombre}</strong>}
                        {branch.direccion && <div>{branch.direccion}</div>}
                    </div>
                    {query && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`} target="_blank"
                        rel="noopener noreferrer" style={{ color: "var(--bl-ink, #196b1f)", fontWeight: 700 }}>Cómo llegar</a>}
                </li>
            })}
        </ul>
    </PublicOverlay>
}
