CREATE POLICY "arquivos auth read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'arquivos');
CREATE POLICY "arquivos auth insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'arquivos');
CREATE POLICY "arquivos auth update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'arquivos') WITH CHECK (bucket_id = 'arquivos');
CREATE POLICY "arquivos auth delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'arquivos');