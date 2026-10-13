import React from "react"
import { motion } from "framer-motion"
export default function AnimationTest() {
  return <main style={{ background: "white", minHeight: "100dvh", display: "grid", placeItems: "center" }}>
    <motion.div style={{ margin: 50, width: 100, height: 100, borderRadius: 5, background: "rgba(150,150,150,.15)" }} animate={{ scale: 1.5 }} whileHover={{ rotate: 90 }} aria-label="Prueba de animación" />
  </main>
}
