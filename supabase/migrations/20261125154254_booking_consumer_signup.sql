-- Los clientes que se registran desde una agenda completan sus datos al reservar.
ALTER TABLE public.consumidores
  ALTER COLUMN nombre_persona DROP NOT NULL,
  ALTER COLUMN apellido DROP NOT NULL,
  ALTER COLUMN telefono DROP NOT NULL,
  ALTER COLUMN intereses DROP NOT NULL;

CREATE TABLE public.booking_consumer_signup (
  email text PRIMARY KEY,
  challenge_id uuid NOT NULL,
  code_hash text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5)
);
ALTER TABLE public.booking_consumer_signup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_consumer_signup FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_consumer_signup TO service_role;

CREATE FUNCTION public.issue_booking_consumer_signup(p_email text, p_challenge uuid, p_hash text)
RETURNS boolean LANGUAGE sql SET search_path = '' AS $$
  WITH issued AS (
    INSERT INTO public.booking_consumer_signup AS previous (email, challenge_id, code_hash)
    VALUES (p_email, p_challenge, p_hash)
    ON CONFLICT (email) DO UPDATE
    SET challenge_id = EXCLUDED.challenge_id, code_hash = EXCLUDED.code_hash,
        sent_at = EXCLUDED.sent_at, expires_at = EXCLUDED.expires_at, attempts = 0
    WHERE previous.sent_at <= now() - interval '1 minute'
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM issued);
$$;

CREATE FUNCTION public.complete_booking_consumer_signup(p_email text, p_challenge uuid, p_hash text, p_password_hash text)
RETURNS uuid LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE challenge public.booking_consumer_signup%ROWTYPE; consumer_id uuid;
BEGIN
  SELECT * INTO challenge FROM public.booking_consumer_signup
  WHERE email = p_email AND challenge_id = p_challenge FOR UPDATE;
  IF NOT FOUND OR challenge.expires_at <= now() OR challenge.attempts >= 5 THEN
    RETURN NULL;
  END IF;
  IF challenge.code_hash IS DISTINCT FROM p_hash THEN
    UPDATE public.booking_consumer_signup SET attempts = attempts + 1 WHERE email = p_email;
    RETURN NULL;
  END IF;

  SELECT id INTO consumer_id FROM public.consumidores
  WHERE email = p_email AND activo AND email_verificado;
  IF consumer_id IS NULL THEN
    BEGIN
      INSERT INTO public.consumidores(email, password) VALUES (p_email, p_password_hash)
      ON CONFLICT (email) DO NOTHING
      RETURNING id INTO consumer_id;
    EXCEPTION WHEN unique_violation THEN
      -- La identidad de un prestador se mantiene separada.
      consumer_id := NULL;
    END;
    IF consumer_id IS NULL THEN
      SELECT id INTO consumer_id FROM public.consumidores
      WHERE email = p_email AND activo AND email_verificado;
    END IF;
  END IF;
  UPDATE public.booking_consumer_signup SET expires_at = now(), code_hash = '' WHERE email = p_email;
  RETURN consumer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_booking_consumer_signup(text, uuid, text),
  public.complete_booking_consumer_signup(text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_booking_consumer_signup(text, uuid, text),
  public.complete_booking_consumer_signup(text, uuid, text, text) TO service_role;
NOTIFY pgrst, 'reload schema';
