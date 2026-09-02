-- Preserve the predefined trade key while recording an artisan's actual
-- customer-facing skill when they choose "Other Skilled Artisan".
ALTER TABLE public.mechanics
  ADD COLUMN IF NOT EXISTS other_skill text;

ALTER TABLE public.mechanics
  ADD CONSTRAINT mechanics_other_skill_for_other_trade
  CHECK (trade <> 'other' OR NULLIF(btrim(other_skill), '') IS NOT NULL) NOT VALID;

-- Column privileges are explicitly restricted by existing hardening
-- migrations, so include the new field for registration/profile edits and
-- public directory reads.
GRANT INSERT (other_skill) ON public.mechanics TO authenticated;
GRANT UPDATE (other_skill) ON public.mechanics TO authenticated;
GRANT SELECT (other_skill) ON public.mechanics TO anon, authenticated;

CREATE INDEX IF NOT EXISTS mechanics_other_skill_search_idx
  ON public.mechanics (lower(other_skill))
  WHERE other_skill IS NOT NULL;
