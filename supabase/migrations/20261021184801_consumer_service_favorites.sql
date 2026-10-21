CREATE TABLE public.consumidor_servicios_favoritos (
 consumidor_id uuid NOT NULL REFERENCES public.consumidores(id) ON DELETE CASCADE,
 servicio_id uuid NOT NULL REFERENCES public.servicios(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (consumidor_id,servicio_id)
);
ALTER TABLE public.consumidor_servicios_favoritos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.consumidor_servicios_favoritos FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.consumidor_servicios_favoritos TO service_role;
