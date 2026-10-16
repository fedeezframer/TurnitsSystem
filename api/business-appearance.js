// A profile row is authoritative, including an explicitly empty photo.
// Businesses without a profile keep their previous business icon.
export async function businessIcon(supabase, slug, legacyLogo = null) {
  const { data, error } = await supabase
    .from("negocio_perfiles")
    .select("foto_perfil_url")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    if (["42P01", "42703", "PGRST204", "PGRST205"].includes(error.code))
      return legacyLogo || null;
    throw error;
  }
  return data ? data.foto_perfil_url || null : legacyLogo || null;
}
