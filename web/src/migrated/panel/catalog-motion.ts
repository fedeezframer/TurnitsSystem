import { useReducedMotion } from "framer-motion"

export function useCatalogTransition() {
    const reduced = useReducedMotion()
    return {
        initial: { opacity: reduced ? 1 : 0, y: reduced ? 0 : 4 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: reduced ? 1 : 0, y: reduced ? 0 : -2, transition: { duration: reduced ? 0 : 0.1 } },
        transition: { duration: reduced ? 0 : 0.16, ease: "easeOut" as const },
    }
}
