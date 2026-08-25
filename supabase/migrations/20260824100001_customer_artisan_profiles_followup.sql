-- PostgreSQL does not permit a newly added enum value to be used until the
-- transaction that adds it has committed. This follows the enum-only migration.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female'));

ALTER TABLE public.mechanics ALTER COLUMN whatsapp DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE selected_role public.app_role;
BEGIN
  selected_role := CASE NEW.raw_user_meta_data->>'account_type'
    WHEN 'artisan' THEN 'artisan'::public.app_role
    ELSE 'customer'::public.app_role
  END;
  INSERT INTO public.profiles (id, email, full_name, phone, gender)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone', NEW.raw_user_meta_data->>'gender');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, selected_role);
  RETURN NEW;
END; $$;

INSERT INTO public.user_roles (user_id, role)
SELECT p.id, CASE WHEN m.user_id IS NULL THEN 'customer'::public.app_role ELSE 'artisan'::public.app_role END
FROM public.profiles p LEFT JOIN public.mechanics m ON m.user_id = p.id
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id);

CREATE OR REPLACE FUNCTION public.request_participant(_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() = _profile_id OR EXISTS (
    SELECT 1 FROM public.inquiries i JOIN public.mechanics m ON m.id = i.mechanic_id
    WHERE i.status = 'accepted' AND ((i.customer_id = auth.uid() AND m.user_id = _profile_id) OR (i.customer_id = _profile_id AND m.user_id = auth.uid()))
  );
$$;
REVOKE ALL ON FUNCTION public.request_participant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_participant(uuid) TO authenticated;
