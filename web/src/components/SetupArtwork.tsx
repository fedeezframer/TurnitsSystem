import React from "react";

export type SetupStep = "servicios" | "horarios" | "pagos";
const images: Record<SetupStep, string> = {
  servicios: "/assets/setup/setup-services.webp",
  horarios: "/assets/setup/setup-calendar.webp",
  pagos: "/assets/setup/setup-payments.webp",
};

export default function SetupArtwork({ step, className = "" }: { step?: SetupStep; className?: string }) {
  if (!step) return null;
  return <img className={`setup-art setup-art-${step} ${className}`} src={images[step]} alt="" aria-hidden="true" decoding="async" />;
}
