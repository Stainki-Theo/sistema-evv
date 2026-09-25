-- Grupo Supervisão: acesso exclusivo ao nível SUPERVISOR (role operador).
DROP POLICY IF EXISTS "supervisao_items members" ON public.supervisao_items;
DROP POLICY IF EXISTS "supervisao_items supervisors" ON public.supervisao_items;

CREATE POLICY "supervisao_items supervisors"
ON public.supervisao_items
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'operador'))
WITH CHECK (public.has_role(auth.uid(), 'operador'));
