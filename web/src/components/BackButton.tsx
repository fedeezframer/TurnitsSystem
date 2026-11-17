import * as React from "react"
import "./BackButton.css"

type BackButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
    /** Lo ubica arriba a la derecha del contenedor posicionado más cercano. */
    floating?: boolean
}

// Botón único de regreso / cierre del panel: círculo de 48px con el ícono
// "arrow-uturn-down-left" de 24px centrado. Se usa en todos los overlays y en
// los componentes con varios pasos, siempre arriba a la derecha.
export const BackButton = React.forwardRef<HTMLButtonElement, BackButtonProps>(function BackButton(
    { floating = false, className, type = "button", "aria-label": ariaLabel = "Volver", ...rest },
    ref
) {
    return (
        <button
            ref={ref}
            type={type}
            aria-label={ariaLabel}
            title={ariaLabel}
            className={["turnits-back-button", floating ? "is-floating" : "", className].filter(Boolean).join(" ")}
            {...rest}
        >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path
                    d="M14.9997 3C16.9888 3 18.8965 3.79018 20.303 5.1967C21.7095 6.60322 22.4997 8.51088 22.4997 10.5C22.4997 12.4891 21.7095 14.3968 20.303 15.8033C18.8965 17.2098 16.9888 18 14.9997 18H6.62068L8.56018 19.9395C8.70344 20.0779 8.81772 20.2434 8.89633 20.4264C8.97495 20.6094 9.01632 20.8062 9.01805 21.0054C9.01979 21.2046 8.98183 21.4021 8.90641 21.5864C8.83099 21.7708 8.71961 21.9383 8.57877 22.0791C8.43793 22.2199 8.27045 22.3313 8.08611 22.4067C7.90177 22.4822 7.70425 22.5201 7.50508 22.5184C7.30591 22.5166 7.10908 22.4753 6.92607 22.3967C6.74307 22.318 6.57755 22.2038 6.43918 22.0605L1.93918 17.5605C1.65797 17.2792 1.5 16.8977 1.5 16.5C1.5 16.1023 1.65797 15.7208 1.93918 15.4395L6.43918 10.9395C6.72208 10.6663 7.10099 10.5151 7.49428 10.5185C7.88758 10.5219 8.26379 10.6797 8.54191 10.9578C8.82002 11.2359 8.97777 11.6121 8.98119 12.0054C8.98461 12.3987 8.83342 12.7776 8.56018 13.0605L6.62068 15H14.9997C16.1932 15 17.3377 14.5259 18.1817 13.682C19.0256 12.8381 19.4997 11.6935 19.4997 10.5C19.4997 9.30653 19.0256 8.16193 18.1817 7.31802C17.3377 6.47411 16.1932 6 14.9997 6H7.49968C7.10185 6 6.72032 5.84196 6.43902 5.56066C6.15772 5.27936 5.99968 4.89782 5.99968 4.5C5.99968 4.10218 6.15772 3.72064 6.43902 3.43934C6.72032 3.15804 7.10185 3 7.49968 3H14.9997Z"
                    fill="currentColor"
                />
            </svg>
        </button>
    )
})

export default BackButton
