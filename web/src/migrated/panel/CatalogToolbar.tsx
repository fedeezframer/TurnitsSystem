import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"

export function CatalogToolbar<F extends string,S extends string>({filters,label,filterValue,onFilter,sort,onSort,opcionesOrden,search,onSearch,onCreate}: {
    filters: readonly {id:F;label:string}[]; label: string; filterValue: string; onFilter: (value:F)=>void;
    sort: string; onSort: (value:S)=>void; opcionesOrden: readonly {id:S;label:string}[];
    search:string; onSearch:(value:string)=>void; onCreate?:()=>void
}) {
    const [open,setOpen] = React.useState(false)
    const etiquetaOrden = opcionesOrden.find(option => option.id === sort)?.label || "Orden"
    return (<div className="svc-toolbar">
                        <div className="svc-toolbar-filters" role="group" aria-label={`Filtrar ${label}`}>
                            {filters.map(filter => (
                                <button key={filter.id} type="button" className={`svc-filter-button${filterValue === filter.id ? " is-active" : ""}`} aria-pressed={filterValue === filter.id} onClick={() => onFilter(filter.id)}>
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                        <div className="svc-sort-control">
                            <button type="button" className="svc-sort-button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(open => !open)}>
                                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5h16l-6 7v5l-4 2v-7L4 5Z"/></svg>
                                {etiquetaOrden}
                                <svg aria-hidden="true" className="svc-sort-chevron" width="11" height="11" viewBox="0 0 12 12" fill="currentColor"><path d="m2 4 4 4 4-4"/></svg>
                            </button>
                            <AnimatePresence>
                                {open && <motion.div className="svc-sort-menu" role="menu" initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4}} transition={{duration:.14}}>
                                    {opcionesOrden.map(option => <button key={option.id} type="button" role="menuitemradio" aria-checked={sort === option.id} onClick={() => {onSort(option.id);setOpen(false)}}>{option.label}</button>)}
                                </motion.div>}
                            </AnimatePresence>
                        </div>
                        <label className="svc-search">
                            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></svg>
                            <input value={search} onChange={event => onSearch(event.target.value)} placeholder="Buscar" aria-label={`Buscar ${label}`} />
                        </label>
                        {onCreate && (
                            <motion.button className="svc-create-button" whileHover={{y:-1}} whileTap={{scale:.98}} onClick={onCreate}>
                                <span aria-hidden="true">+</span> Nuevo
                            </motion.button>
                        )}
                    </div>)
}
