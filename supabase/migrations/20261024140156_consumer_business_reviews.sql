BEGIN;

CREATE TABLE public.resenas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumidor_id uuid NOT NULL REFERENCES public.consumidores(id) ON DELETE CASCADE,
  slug text NOT NULL REFERENCES public.usuarios(slug) ON DELETE CASCADE,
  turno_id uuid REFERENCES public.turnos(id) ON DELETE SET NULL,
  puntuacion integer NOT NULL CHECK (puntuacion BETWEEN 1 AND 5),
  comentario text NOT NULL DEFAULT '' CHECK (char_length(btrim(comentario)) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (consumidor_id, slug)
);

CREATE INDEX resenas_slug_created_at ON public.resenas(slug, created_at DESC);
ALTER TABLE public.resenas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.resenas FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resenas TO service_role;

COMMIT;
