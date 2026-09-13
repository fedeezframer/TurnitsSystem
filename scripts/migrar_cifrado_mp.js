// ══════════════════════════════════════════════════════════════
// Script ONE-OFF: cifra los mp_access_token / mp_refresh_token que
// hoy están en texto plano en la tabla "usuarios".
//
// Correr UNA sola vez, después de:
//   1) Correr migracion_mp_seguridad.sql (agrega columnas nuevas).
//   2) Configurar MP_TOKEN_ENC_KEY en Render (y localmente para
//      poder correr este script).
//   3) Deployar el Server.js actualizado (para que a partir de ahora
//      todo se guarde ya cifrado).
//
// Uso:
//   MP_TOKEN_ENC_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node migrar_cifrado_mp.js
// ══════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const MP_TOKEN_ENC_KEY = process.env.MP_TOKEN_ENC_KEY;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!MP_TOKEN_ENC_KEY) {
  console.error("❌ Falta MP_TOKEN_ENC_KEY.");
  process.exit(1);
}

function encryptMpSecret(plainText) {
  if (!plainText) return null;
  const key = crypto.createHash("sha256").update(MP_TOKEN_ENC_KEY).digest();
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

async function main() {
  const { data: usuarios, error } = await supabase
    .from("usuarios")
    .select("slug, mp_access_token, mp_refresh_token")
    .not("mp_access_token", "is", null);

  if (error) throw error;

  let migrados = 0;
  for (const u of usuarios || []) {
    // Si ya empieza con "enc:v1:" ya fue migrado (o ya se conectó de nuevo
    // con el Server.js nuevo) -> lo salteamos.
    const yaCifradoAccess  = typeof u.mp_access_token === "string" && u.mp_access_token.startsWith("enc:v1:");
    const yaCifradoRefresh = !u.mp_refresh_token || (typeof u.mp_refresh_token === "string" && u.mp_refresh_token.startsWith("enc:v1:"));
    if (yaCifradoAccess && yaCifradoRefresh) continue;

    const { error: updError } = await supabase.from("usuarios").update({
      mp_access_token:  yaCifradoAccess  ? u.mp_access_token  : encryptMpSecret(u.mp_access_token),
      mp_refresh_token: yaCifradoRefresh ? u.mp_refresh_token : encryptMpSecret(u.mp_refresh_token),
    }).eq("slug", u.slug);

    if (updError) {
      console.error(`❌ Error migrando ${u.slug}:`, updError.message);
    } else {
      migrados++;
      console.log(`✅ Cifrado: ${u.slug}`);
    }
  }

  console.log(`\nListo. ${migrados} negocio(s) migrado(s).`);
}

main().catch((e) => {
  console.error("❌ Error general:", e.message);
  process.exit(1);
});
