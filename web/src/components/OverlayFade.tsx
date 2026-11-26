import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion"

export function OverlayFade(props: HTMLMotionProps<"div">) {
    const reducedMotion = useReducedMotion()
    return <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, pointerEvents: "none" }}
        transition={{ duration: reducedMotion ? 0 : 0.18, ease: "easeOut" }}
        {...props}
    />
}
