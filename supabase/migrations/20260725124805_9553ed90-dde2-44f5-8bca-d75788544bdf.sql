
-- 1) Revoke EXECUTE on trigger/internal SECURITY DEFINER functions from public roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_mechanic_rating() FROM PUBLIC, anon, authenticated;

-- 2) Mechanics: hide sensitive columns (email, id_document_url) from anon and authenticated
--    Owner/admin reads of these fields go through a SECURITY DEFINER RPC below.
REVOKE SELECT ON public.mechanics FROM anon, authenticated;
GRANT SELECT (
  id, user_id, full_name, business_name, profile_picture_url, phone, whatsapp,
  state, city, area, address, latitude, longitude, years_experience, brands,
  services, bio, status, availability, verified, paid, featured,
  rating_avg, rating_count, trade, created_at, updated_at
) ON public.mechanics TO anon, authenticated;

-- Preserve insert/update/delete grants on mechanics
GRANT INSERT, UPDATE, DELETE ON public.mechanics TO authenticated;
GRANT ALL ON public.mechanics TO service_role;

-- Admin-only accessor for the sensitive ID document
CREATE OR REPLACE FUNCTION public.get_mechanic_id_document(_mechanic_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id_document_url
  FROM public.mechanics
  WHERE id = _mechanic_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR user_id = auth.uid()
    );
$$;
REVOKE EXECUTE ON FUNCTION public.get_mechanic_id_document(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_mechanic_id_document(uuid) TO authenticated;

-- 3) Reviews: require authentication, tie each review to the reviewer
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "anyone can review" ON public.reviews;
CREATE POLICY "authenticated can review"
  ON public.reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = customer_id
    AND EXISTS (
      SELECT 1 FROM public.mechanics m
      WHERE m.id = reviews.mechanic_id
        AND m.status = 'approved'
    )
  );

-- 4) Inquiries: keep public-writable but require valid, approved mechanic target
DROP POLICY IF EXISTS "public send inquiry" ON public.inquiries;
CREATE POLICY "public send inquiry"
  ON public.inquiries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mechanics m
      WHERE m.id = inquiries.mechanic_id
        AND m.status = 'approved'
    )
    AND length(customer_name) BETWEEN 1 AND 120
    AND length(message) BETWEEN 1 AND 2000
  );
