
-- Restore column-level SELECT of sensitive fields to authenticated so that
-- owners (dashboard) and admins (admin panel) can still read them under RLS.
-- Anon remains blocked from these columns.
GRANT SELECT (email, id_document_url) ON public.mechanics TO authenticated;
