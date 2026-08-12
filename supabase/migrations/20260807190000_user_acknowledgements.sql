-- Immutable audit record of the acknowledgement accepted during signup.
CREATE TABLE IF NOT EXISTS public.user_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at timestamptz NOT NULL,
  acknowledgement_version text NOT NULL,
  terms_accepted boolean NOT NULL DEFAULT false,
  privacy_accepted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, acknowledgement_version)
);

ALTER TABLE public.user_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own acknowledgements"
  ON public.user_acknowledgements FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Signup metadata is written atomically with the auth user, including when
-- email confirmation means the browser does not receive a session yet.
CREATE OR REPLACE FUNCTION public.capture_signup_acknowledgement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF COALESCE((NEW.raw_user_meta_data ->> 'acknowledgement_accepted')::boolean, false)
     AND COALESCE((NEW.raw_user_meta_data ->> 'terms_accepted')::boolean, false)
     AND COALESCE((NEW.raw_user_meta_data ->> 'privacy_accepted')::boolean, false)
     AND NULLIF(NEW.raw_user_meta_data ->> 'acknowledgement_version', '') IS NOT NULL
     AND NULLIF(NEW.raw_user_meta_data ->> 'acknowledgement_accepted_at', '') IS NOT NULL THEN
    INSERT INTO public.user_acknowledgements (
      user_id, accepted_at, acknowledgement_version, terms_accepted, privacy_accepted
    ) VALUES (
      NEW.id,
      (NEW.raw_user_meta_data ->> 'acknowledgement_accepted_at')::timestamptz,
      NEW.raw_user_meta_data ->> 'acknowledgement_version',
      true,
      true
    ) ON CONFLICT (user_id, acknowledgement_version) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_capture_acknowledgement ON auth.users;
CREATE TRIGGER on_auth_user_created_capture_acknowledgement
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.capture_signup_acknowledgement();

REVOKE ALL ON public.user_acknowledgements FROM anon;
GRANT SELECT ON public.user_acknowledgements TO authenticated;
