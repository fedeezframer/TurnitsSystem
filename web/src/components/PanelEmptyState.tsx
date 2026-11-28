import type { ReactNode } from "react"
import "./PanelEmptyState.css"

const illustrations = {
    calendar: "/assets/framer/2AHO8lTnQ55sjzJjkRiQ8yFTlA.png",
    people: "/assets/framer/l3W1CGBW1hng0mXC6Hlj04IC0.png",
    activity: "/assets/framer/3gbRcNvLr1hE6sVjIgrCJcCHbw.png",
    catalog: "/assets/setup/setup-services.webp",
    payments: "/assets/setup/setup-payments.webp",
}

export default function PanelEmptyState({ children, artwork, compact = false }: {
    children: ReactNode
    artwork: keyof typeof illustrations
    compact?: boolean
}) {
    return <div className="panel-illustrated-empty" data-compact={compact} role="status">
        <img src={illustrations[artwork]} alt="" loading="lazy" decoding="async" />
        <p>{children}</p>
    </div>
}
