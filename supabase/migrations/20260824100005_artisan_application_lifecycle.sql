-- `paid`, `status`, and `verified` are the existing authoritative artisan
-- lifecycle fields. Make their relationship enforceable at the database edge.

CREATE OR REPLACE FUNCTION public.admin_set_mechanic_status(
  _mechanic_id uuid, _status public.mechanic_status
)
RETURNS public.mechanics
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE updated_mechanic public.mechanics;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can change artisan approval status';
  END IF;

  IF _status = 'approved' AND NOT EXISTS (
    SELECT 1 FROM public.mechanics
    WHERE id = _mechanic_id AND paid = true AND id_document_url IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'An artisan must complete payment and submit government ID before approval';
  END IF;

  UPDATE public.mechanics
  SET status = _status,
      verified = CASE WHEN _status = 'approved' THEN true ELSE false END
  WHERE id = _mechanic_id
  RETURNING * INTO updated_mechanic;

  IF NOT FOUND THEN RAISE EXCEPTION 'Artisan not found'; END IF;
  RETURN updated_mechanic;
END; $$;

-- Owners may edit the allowed profile fields, but only an approved, verified,
-- paid artisan may advertise availability to receive customer requests.
CREATE OR REPLACE FUNCTION public.enforce_mechanic_application_lifecycle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() = OLD.user_id
    AND NEW.availability IS DISTINCT FROM OLD.availability
    AND (OLD.status <> 'approved' OR OLD.verified IS NOT TRUE OR OLD.paid IS NOT TRUE) THEN
    RAISE EXCEPTION 'Only approved, paid artisans can change availability';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS mechanics_application_lifecycle ON public.mechanics;
CREATE TRIGGER mechanics_application_lifecycle
  BEFORE UPDATE ON public.mechanics
  FOR EACH ROW EXECUTE FUNCTION public.enforce_mechanic_application_lifecycle();
