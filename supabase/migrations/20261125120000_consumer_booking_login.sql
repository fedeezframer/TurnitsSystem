CREATE TABLE public.consumer_booking_login (
  consumer_id uuid PRIMARY KEY REFERENCES public.consumidores(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL UNIQUE,
  code_hash text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5)
);

ALTER TABLE public.consumer_booking_login ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.consumer_booking_login FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consumer_booking_login TO service_role;

CREATE FUNCTION public.issue_consumer_booking_code(p_consumer uuid, p_challenge uuid, p_hash text)
RETURNS boolean LANGUAGE sql SET search_path = '' AS $$
  WITH issued AS (
    INSERT INTO public.consumer_booking_login AS previous (consumer_id, challenge_id, code_hash)
    VALUES (p_consumer, p_challenge, p_hash)
    ON CONFLICT (consumer_id) DO UPDATE
    SET challenge_id = EXCLUDED.challenge_id, code_hash = EXCLUDED.code_hash,
        sent_at = EXCLUDED.sent_at, expires_at = EXCLUDED.expires_at, attempts = 0
    WHERE previous.sent_at <= now() - interval '1 minute'
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM issued);
$$;

CREATE FUNCTION public.consume_consumer_booking_code(p_consumer uuid, p_challenge uuid, p_hash text)
RETURNS boolean LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE challenge public.consumer_booking_login%ROWTYPE;
BEGIN
  SELECT * INTO challenge FROM public.consumer_booking_login
  WHERE consumer_id = p_consumer AND challenge_id = p_challenge FOR UPDATE;
  IF NOT FOUND OR challenge.expires_at <= now() OR challenge.attempts >= 5 THEN
    RETURN false;
  END IF;
  IF challenge.code_hash IS DISTINCT FROM p_hash THEN
    UPDATE public.consumer_booking_login SET attempts = attempts + 1
    WHERE consumer_id = p_consumer;
    RETURN false;
  END IF;
  -- Retain the cooldown and prevent reuse of the code.
  UPDATE public.consumer_booking_login SET expires_at = now(), code_hash = ''
  WHERE consumer_id = p_consumer;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_consumer_booking_code(uuid, uuid, text),
  public.consume_consumer_booking_code(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_consumer_booking_code(uuid, uuid, text),
  public.consume_consumer_booking_code(uuid, uuid, text) TO service_role;
NOTIFY pgrst, 'reload schema';
