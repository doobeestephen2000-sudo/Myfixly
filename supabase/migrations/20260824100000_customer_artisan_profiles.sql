-- Extend the existing shared account/profile model. Roles are assigned only by
-- the signup trigger; clients retain no INSERT/UPDATE permission on user_roles.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'artisan';
