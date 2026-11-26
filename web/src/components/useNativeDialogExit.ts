import * as React from "react"

export function useNativeDialogExit(onExit: () => void) {
    const timer = React.useRef<number>()
    React.useEffect(() => () => window.clearTimeout(timer.current), [])
    return (event: React.SyntheticEvent<HTMLDialogElement>) => {
        const dialog = event.currentTarget
        window.clearTimeout(timer.current)
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
            !CSS.supports("transition-behavior", "allow-discrete")) {
            onExit()
            return
        }
        timer.current = window.setTimeout(() => {
            if (!dialog.open) onExit()
        }, 180)
    }
}
