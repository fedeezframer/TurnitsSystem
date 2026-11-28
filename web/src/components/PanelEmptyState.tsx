import "./PanelEmptyState.css"

export default function PanelEmptyState({ children }: { children: string }) {
    return <div className="panel-empty-state" role="status">
        <picture>
            <source media="(prefers-reduced-motion: reduce)" srcSet="/assets/agenda/agendita-quieta.png" />
            <img src="/assets/agenda/agendita-rodadoras.gif" width={560} height={300} loading="lazy" alt="" />
        </picture>
        <p>{children}</p>
    </div>
}
