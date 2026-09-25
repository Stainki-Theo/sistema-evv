DROP POLICY IF EXISTS "profiles_update_operacional" ON public.profiles;
CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'administrador'));

DROP POLICY IF EXISTS "arquivos auth insert" ON storage.objects;
DROP POLICY IF EXISTS "arquivos auth update" ON storage.objects;
DROP POLICY IF EXISTS "arquivos auth delete" ON storage.objects;

CREATE POLICY "arquivos auth insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'arquivos' AND owner = auth.uid());

CREATE POLICY "arquivos owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'arquivos' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'administrador')))
  WITH CHECK (bucket_id = 'arquivos' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'administrador')));

CREATE POLICY "arquivos owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'arquivos' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'administrador')));