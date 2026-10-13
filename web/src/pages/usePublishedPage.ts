import { RefObject, useEffect } from "react"

// La maqueta publicada conserva sus estilos; React controla las animaciones
// de entrada y los componentes interactivos sin cargar el runtime de Framer.
export function usePublishedPage(root: RefObject<HTMLElement | null>, title: string) {
  useEffect(() => {
    const previous = document.title
    document.title = title
    const elements = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-framer-appear-id], [style*="translateY(50px) scale(0.3)"]') || [])
    const reveal = (element: HTMLElement) => {
      element.style.transition = matchMedia("(prefers-reduced-motion:reduce)").matches ? "none" : "opacity .7s ease, transform .7s ease"
      element.style.opacity = "1"; element.style.transform = "none"
    }
    const observed = new Map<Element, HTMLElement[]>()
    elements.forEach(element => {
      // Algunos textos parten fuera de un contenedor que recorta el contenido.
      // Se observa su marco para que la traslación inicial no impida la entrada.
      let frame = element.parentElement || element
      while (frame.parentElement && getComputedStyle(frame).display === "contents") frame = frame.parentElement
      observed.set(frame, [...(observed.get(frame) || []), element])
    })
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { observed.get(entry.target)?.forEach(reveal); observer.unobserve(entry.target) }
    }), { threshold: 0.08 })
    observed.forEach((_, frame) => observer.observe(frame))
    return () => { observer.disconnect(); document.title = previous }
  }, [root, title])
}
