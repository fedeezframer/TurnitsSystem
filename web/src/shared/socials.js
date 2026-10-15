export const SOCIAL_LINKS = [
  {
    key: "instagram",
    label: "Instagram",
    placeholder: "instagram.com/tu.negocio",
    hosts: ["instagram.com"],
    handle: "https://www.instagram.com/",
  },
  {
    key: "facebook",
    label: "Facebook",
    placeholder: "facebook.com/tu.negocio",
    hosts: ["facebook.com", "m.facebook.com"],
  },
  {
    key: "tiktok",
    label: "TikTok",
    placeholder: "tiktok.com/@tu.negocio",
    hosts: ["tiktok.com"],
    handle: "https://www.tiktok.com/@",
  },
  {
    key: "youtube",
    label: "YouTube",
    placeholder: "youtube.com/@tu.negocio",
    hosts: ["youtube.com"],
    handle: "https://www.youtube.com/@",
  },
  {
    key: "x",
    label: "X",
    placeholder: "x.com/tu_negocio",
    hosts: ["x.com", "twitter.com"],
    handle: "https://x.com/",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    placeholder: "linkedin.com/company/tu-negocio",
    hosts: ["linkedin.com"],
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    placeholder: "wa.me/543511234567",
    hosts: ["wa.me", "api.whatsapp.com"],
  },
];
export function normalizarEnlaceRed(key, raw) {
  const red = SOCIAL_LINKS.find((s) => s.key === key);
  if (!red || typeof raw !== "string")
    throw new Error("Revisá los enlaces de redes sociales.");
  let value = raw.trim();
  if (!value) return "";
  if (value.length > 350 || /\s/.test(value))
    throw new Error(`Revisá el enlace de ${red.label}.`);
  if (value.startsWith("@") && red.handle && /^@[\w.\-]+$/.test(value))
    value = red.handle + value.slice(1);
  if (!/^[a-z][a-z\d+.-]*:/i.test(value)) value = "https://" + value;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Revisá el enlace de ${red.label}.`);
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !red.hosts.includes(host) ||
    !url.pathname.replaceAll("/", "")
  )
    throw new Error(`Usá un enlace de perfil de ${red.label}.`);
  if (
    key === "whatsapp" &&
    !(
      (host === "wa.me" && /^\/\d{8,16}\/?$/.test(url.pathname)) ||
      (host === "api.whatsapp.com" &&
        url.pathname === "/send" &&
        /^\d{8,16}$/.test(url.searchParams.get("phone") || ""))
    )
  )
    throw new Error(
      "Usá un enlace de WhatsApp con el número y código de país.",
    );
  if (
    key === "youtube" &&
    !/^\/(?:@[\w.\-]+|(?:channel|c|user)\/[\w.\-]+)\/?$/.test(url.pathname)
  )
    throw new Error("Usá el enlace de tu canal de YouTube.");
  url.hash = "";
  return url.href;
}
export function enlacesPublicos(perfil) {
  return SOCIAL_LINKS.flatMap((red) => {
    try {
      const url = normalizarEnlaceRed(
        red.key,
        red.key === "instagram"
          ? perfil.instagram || ""
          : perfil.redes_sociales?.[red.key] || "",
      );
      return url ? [{ ...red, url }] : [];
    } catch {
      return [];
    }
  });
}
