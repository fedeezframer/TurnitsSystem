export type SocialKey =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "x"
  | "linkedin"
  | "whatsapp";
export const SOCIAL_LINKS: {
  key: SocialKey;
  label: string;
  placeholder: string;
  hosts: string[];
  handle?: string;
}[];
export function normalizarEnlaceRed(key: string, raw: unknown): string;
export function enlacesPublicos(
  perfil: any,
): { key: SocialKey; label: string; placeholder: string; url: string }[];
