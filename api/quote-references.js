export function createReferenceCleanup(supabase) {
  let busy = false;
  return async () => {
    if (busy) return; busy = true;
    try {
      const retention = await supabase.rpc("consulta_retener_referencias"); if (retention.error) throw retention.error;
      const pending = await supabase.from("consulta_archivos_eliminar").select("path").order("created_at").limit(100); if (pending.error) throw pending.error;
      for (const file of pending.data || []) {
        const removed = await supabase.storage.from("consulta-referencias").remove([file.path]);
        if (!removed.error) { const result = await supabase.from("consulta_archivos_eliminar").delete().eq("path", file.path); if (result.error) throw result.error; }
      }
    } finally { busy = false; }
  };
}
