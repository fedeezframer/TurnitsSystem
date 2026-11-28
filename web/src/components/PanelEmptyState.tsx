import "./PanelEmptyState.css"

export default function PanelEmptyState({ children, fullPage = false }: { children: string; fullPage?: boolean }) {
    return <div className="panel-empty-state" data-full-page={fullPage} role="status">
        <picture>
            <source media="(prefers-reduced-motion: reduce)" srcSet="/assets/agenda/agendita-quieta.png" />
            <source type="image/webp" srcSet="/assets/agenda/agendita-rodadoras.webp" />
            <img src="/assets/agenda/agendita-rodadoras.gif?v=2" width={560} height={300} loading="lazy" alt="" />
        </picture>
        <p>{children}</p>
    </div>
}
