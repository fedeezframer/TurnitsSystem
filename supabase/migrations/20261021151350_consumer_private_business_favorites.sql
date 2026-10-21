CREATE TABLE public.consumidor_favoritos (
 consumidor_id uuid NOT NULL REFERENCES public.consumidores(id) ON DELETE CASCADE,
 slug text NOT NULL REFERENCES public.usuarios(slug) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (consumidor_id,slug)
);
ALTER TABLE public.consumidor_favoritos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.consumidor_favoritos FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.consumidor_favoritos TO service_role;
