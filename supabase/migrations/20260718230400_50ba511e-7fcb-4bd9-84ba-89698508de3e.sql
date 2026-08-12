
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_mechanic_rating() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
-- authenticated still needs EXECUTE on has_role for RLS policies:
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
