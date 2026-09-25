-- Helpers de cargo
CREATE OR REPLACE FUNCTION public.is_supervisao(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.cargo IN ('Supervisão','Presidente'))
$$;

CREATE OR REPLACE FUNCTION public.is_diretor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.diretoria_assignments a WHERE a.profile_id = _user_id AND a.tipo = 'DIRETOR')
$$;

CREATE OR REPLACE FUNCTION public.can_manage_ops(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'administrador')
      OR public.is_supervisao(_user_id)
      OR public.is_diretor(_user_id)
$$;

GRANT EXECUTE ON FUNCTION public.is_supervisao(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_diretor(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_ops(uuid) TO authenticated, service_role;

-- Supervisão pode LER as áreas privadas das diretorias (sem editar)
DROP POLICY IF EXISTS "diretoria_items scoped access" ON public.diretoria_items;
CREATE POLICY "diretoria_items read" ON public.diretoria_items FOR SELECT TO authenticated
  USING (public.can_access_diretoria(auth.uid(), diretoria_id, scope) OR public.is_supervisao(auth.uid()));
CREATE POLICY "diretoria_items insert" ON public.diretoria_items FOR INSERT TO authenticated
  WITH CHECK (public.can_access_diretoria(auth.uid(), diretoria_id, scope));
CREATE POLICY "diretoria_items update" ON public.diretoria_items FOR UPDATE TO authenticated
  USING (public.can_access_diretoria(auth.uid(), diretoria_id, scope))
  WITH CHECK (public.can_access_diretoria(auth.uid(), diretoria_id, scope));
CREATE POLICY "diretoria_items delete" ON public.diretoria_items FOR DELETE TO authenticated
  USING (public.can_access_diretoria(auth.uid(), diretoria_id, scope));

-- Categorias do calendário
CREATE TABLE public.calendar_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#1e3a8a',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_categories TO authenticated;
GRANT ALL ON public.calendar_categories TO service_role;
ALTER TABLE public.calendar_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calendar_categories read" ON public.calendar_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "calendar_categories write" ON public.calendar_categories FOR ALL TO authenticated
  USING (public.can_manage_ops(auth.uid())) WITH CHECK (public.can_manage_ops(auth.uid()));
CREATE TRIGGER calendar_categories_updated BEFORE UPDATE ON public.calendar_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.calendar_categories (nome, cor, sort_order) VALUES
  ('Operação', '#1d4ed8', 1),
  ('Reunião', '#7c3aed', 2),
  ('Instrução', '#0f766e', 3),
  ('Manutenção', '#b45309', 4),
  ('Evento', '#be123c', 5),
  ('Outros', '#475569', 6);

-- Eventos do calendário
CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  event_date date NOT NULL,
  end_date date,
  time_ref text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  category_id uuid REFERENCES public.calendar_categories(id) ON DELETE SET NULL,
  responsavel text NOT NULL DEFAULT '',
  diretoria_id uuid REFERENCES public.diretorias(id) ON DELETE SET NULL,
  created_by uuid,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX calendar_events_date_idx ON public.calendar_events (event_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calendar_events read" ON public.calendar_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "calendar_events write" ON public.calendar_events FOR ALL TO authenticated
  USING (public.can_manage_ops(auth.uid())) WITH CHECK (public.can_manage_ops(auth.uid()));
CREATE TRIGGER calendar_events_updated BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Log de alterações
CREATE TABLE public.change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text NOT NULL,
  entity text NOT NULL DEFAULT '',
  entity_id text NOT NULL DEFAULT '',
  entity_label text NOT NULL DEFAULT '',
  action text NOT NULL DEFAULT 'UPDATE',
  field text NOT NULL DEFAULT '',
  field_label text NOT NULL DEFAULT '',
  old_value text NOT NULL DEFAULT '',
  new_value text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  op_date date,
  user_id uuid,
  user_tag text NOT NULL DEFAULT '',
  reverted_at timestamptz,
  reverted_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX change_log_created_idx ON public.change_log (created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.change_log TO authenticated;
GRANT ALL ON public.change_log TO service_role;
ALTER TABLE public.change_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "change_log read" ON public.change_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "change_log insert" ON public.change_log FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "change_log revert" ON public.change_log FOR UPDATE TO authenticated
  USING (public.can_manage_ops(auth.uid())) WITH CHECK (public.can_manage_ops(auth.uid()));

-- Grupo Supervisão
CREATE TABLE public.supervisao_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ABERTO',
  created_by uuid,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supervisao_items TO authenticated;
GRANT ALL ON public.supervisao_items TO service_role;
ALTER TABLE public.supervisao_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supervisao_items members" ON public.supervisao_items FOR ALL TO authenticated
  USING (public.can_manage_ops(auth.uid())) WITH CHECK (public.can_manage_ops(auth.uid()));
CREATE TRIGGER supervisao_items_updated BEFORE UPDATE ON public.supervisao_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();