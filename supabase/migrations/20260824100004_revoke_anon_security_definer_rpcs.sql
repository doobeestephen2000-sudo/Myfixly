-- Supabase grants EXECUTE to anon by default for newly created functions.
-- These RPCs enforce auth.uid() and are intentionally available only to
-- authenticated callers; make that boundary explicit for already-created
-- functions as well.
REVOKE ALL ON FUNCTION public.accept_service_request(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.decline_service_request(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.complete_service_request(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.cancel_own_service_request(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_set_mechanic_status(uuid, public.mechanic_status) FROM anon;
REVOKE ALL ON FUNCTION public.get_my_mechanic() FROM anon;
REVOKE ALL ON FUNCTION public.get_admin_mechanics() FROM anon;
REVOKE ALL ON FUNCTION public.mark_own_mechanic_paid(text) FROM anon;
REVOKE ALL ON FUNCTION public.request_participant(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_mechanic_id_document(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.capture_signup_acknowledgement() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
