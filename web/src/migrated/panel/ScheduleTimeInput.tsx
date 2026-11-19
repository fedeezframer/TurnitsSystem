import * as React from "react"

export function ScheduleTimeInput({
    value,
    onChange,
    placeholder = "--:--",
    disabled = false,
    accentColor = "#2F8A2F",
}: {
    value: string | null
    onChange: (v: string | null) => void
    placeholder?: string
    disabled?: boolean
    accentColor?: string
}) {
    const [raw, setRaw] = React.useState(value || "")
    const [focused, setFocused] = React.useState(false)

    React.useEffect(() => {
        setRaw(value || "")
    }, [value])

    const handleInput = (v: string) => {
        let clean = v.replace(/[^0-9]/g, "").slice(0, 4)
        if (clean.length >= 2) {
            const hh = parseInt(clean.slice(0, 2))
            if (hh > 23) clean = "23" + clean.slice(2)
        }
        if (clean.length === 4) {
            const mm = parseInt(clean.slice(2, 4))
            if (mm > 59) clean = clean.slice(0, 2) + "59"
        }
        const formatted =
            clean.length > 2 ? clean.slice(0, 2) + ":" + clean.slice(2) : clean
        setRaw(formatted)
        if (formatted.length === 5) onChange(formatted)
        else onChange(null)
    }

    const handleBlur = () => {
        setFocused(false)
        if (raw.length > 0 && raw.length < 5) {
            setRaw("")
            onChange(null)
        }
    }

    const isFilled = raw.length === 5
    return (
        <input
            inputMode="numeric"
            value={raw}
            disabled={disabled}
            placeholder={placeholder}
            onFocus={() => setFocused(true)}
            onBlur={handleBlur}
            onChange={(e) => handleInput(e.target.value)}
            style={{
                width: "100%",
                border: "none",
                outline: "none",
                background: disabled
                    ? "#f5f5f5"
                    : isFilled
                      ? "#fff"
                      : "#f5f5f5",
                color: disabled ? "#222" : isFilled ? "#222" : "#999",
                padding: "10px 12px",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                textAlign: "center" as const,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "0.04em",
                transition: "all 0.15s",
                cursor: disabled ? "not-allowed" : "text",
                boxShadow:
                    focused && !disabled ? `0 0 0 2px ${accentColor}` : "none",
                fontFamily: "'Inter', 'Inter Display', sans-serif",
                boxSizing: "border-box" as const,
            }}
        />
    )
}
