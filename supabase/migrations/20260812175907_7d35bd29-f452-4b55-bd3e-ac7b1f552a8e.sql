-- Harden user_roles against privilege escalation: no write privileges for app users.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES ON public.user_roles FROM authenticated;
REVOKE ALL ON public.user_roles FROM anon;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_roles_admin_all ON public.user_roles;
CREATE POLICY user_roles_admin_all ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'::app_role));
