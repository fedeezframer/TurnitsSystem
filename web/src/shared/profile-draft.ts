import { SOCIAL_LINKS, normalizarEnlaceRed } from "./socials.js";

export const perfilVacio = {
  nombre: "",
  descripcion: "",
  categoria: "",
  direccion: "",
  ciudad: "",
  provincia: "",
  telefono_publico: "",
  instagram: "",
  sitio_web: "",
  redes_sociales: {} as Record<string, string>,
  fotos: [] as string[],
  foto_perfil_url: "",
  banner_url: "",
  publicado: false,
};

// Keep only editable fields; server timestamps must never make a draft dirty.
export function perfilDraft(value: any, redes = true, imagenes = true) {
  const data: Record<string, any> = Object.fromEntries(
    Object.entries(perfilVacio).map(([key, fallback]) => [
      key,
      value?.[key] ?? fallback,
    ]),
  );
  if (!redes) delete data.redes_sociales;
  if (!imagenes) {
    delete data.foto_perfil_url;
    delete data.banner_url;
  }
  return data;
}

export function perfilPayload(draft: any) {
  const data = { ...draft };
  if (!data.nombre?.trim()) throw new Error("Escribí el nombre del negocio.");
  data.instagram = normalizarEnlaceRed("instagram", data.instagram || "");
  if (data.redes_sociales !== undefined)
    data.redes_sociales = Object.fromEntries(
      SOCIAL_LINKS.filter((red) => red.key !== "instagram")
        .map((red) => [
          red.key,
          normalizarEnlaceRed(red.key, data.redes_sociales?.[red.key] || ""),
        ])
        .filter(([, value]) => value),
    );
  return data;
}
