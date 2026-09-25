-- ============ AERONAVES ============
CREATE TABLE IF NOT EXISTS public.aircraft (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificacao text NOT NULL,
  tipo text NOT NULL DEFAULT 'PLANADOR',
  callsign text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aircraft TO authenticated;
GRANT ALL ON public.aircraft TO service_role;
ALTER TABLE public.aircraft ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aircraft read auth" ON public.aircraft FOR SELECT TO authenticated USING (true);
CREATE POLICY "aircraft admin write" ON public.aircraft FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrador')) WITH CHECK (public.has_role(auth.uid(),'administrador'));
CREATE TRIGGER aircraft_updated BEFORE UPDATE ON public.aircraft FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ CÓDIGOS DE CHAMADA ============
CREATE TABLE IF NOT EXISTS public.callsigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  aircraft_id uuid REFERENCES public.aircraft(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.callsigns TO authenticated;
GRANT ALL ON public.callsigns TO service_role;
ALTER TABLE public.callsigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "callsigns read auth" ON public.callsigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "callsigns admin write" ON public.callsigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrador')) WITH CHECK (public.has_role(auth.uid(),'administrador'));
CREATE TRIGGER callsigns_updated BEFORE UPDATE ON public.callsigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PLANILHA DO ANOTADOR ============
CREATE TABLE IF NOT EXISTS public.annotator_flights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  op_date date NOT NULL DEFAULT CURRENT_DATE,
  dep_time text NOT NULL DEFAULT '',
  land_time text NOT NULL DEFAULT '',
  missao text NOT NULL DEFAULT '',
  al_1p text NOT NULL DEFAULT '',
  in_2p text NOT NULL DEFAULT '',
  aeronave text NOT NULL DEFAULT '',
  callsign text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '',
  qtd integer NOT NULL DEFAULT 1,
  observacoes text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS annotator_flights_date_idx ON public.annotator_flights (op_date, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.annotator_flights TO authenticated;
GRANT ALL ON public.annotator_flights TO service_role;
ALTER TABLE public.annotator_flights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all annotator_flights" ON public.annotator_flights FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER annotator_flights_updated BEFORE UPDATE ON public.annotator_flights FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.annotator_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  op_date date NOT NULL DEFAULT CURRENT_DATE,
  ordem integer NOT NULL DEFAULT 1,
  hora text NOT NULL DEFAULT '',
  observacao text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS annotator_activations_date_idx ON public.annotator_activations (op_date, ordem);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.annotator_activations TO authenticated;
GRANT ALL ON public.annotator_activations TO service_role;
ALTER TABLE public.annotator_activations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all annotator_activations" ON public.annotator_activations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER annotator_activations_updated BEFORE UPDATE ON public.annotator_activations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ CARGOS POR DIRETORIA ============
CREATE TABLE IF NOT EXISTS public.diretoria_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  diretoria_id uuid NOT NULL REFERENCES public.diretorias(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'DIRETOR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, diretoria_id, tipo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diretoria_assignments TO authenticated;
GRANT ALL ON public.diretoria_assignments TO service_role;
ALTER TABLE public.diretoria_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "diretoria_assignments read auth" ON public.diretoria_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "diretoria_assignments admin write" ON public.diretoria_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrador')) WITH CHECK (public.has_role(auth.uid(),'administrador'));
CREATE TRIGGER diretoria_assignments_updated BEFORE UPDATE ON public.diretoria_assignments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ACESSO ÀS ÁREAS DAS DIRETORIAS ============
CREATE OR REPLACE FUNCTION public.can_access_diretoria(_user_id uuid, _diretoria_id uuid, _scope text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'administrador')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.cargo = 'Presidente')
    OR EXISTS (
      SELECT 1 FROM public.diretoria_assignments a
      WHERE a.profile_id = _user_id
        AND a.diretoria_id = _diretoria_id
        AND (a.tipo = 'DIRETOR' OR (a.tipo = 'ASSESSOR' AND _scope = 'ASSESSORIA'))
    )
$$;
REVOKE ALL ON FUNCTION public.can_access_diretoria(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_diretoria(uuid, uuid, text) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.diretoria_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diretoria_id uuid NOT NULL REFERENCES public.diretorias(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'DIRETORIA',
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ABERTO',
  created_by uuid,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diretoria_items TO authenticated;
GRANT ALL ON public.diretoria_items TO service_role;
ALTER TABLE public.diretoria_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "diretoria_items scoped access" ON public.diretoria_items FOR ALL TO authenticated
  USING (public.can_access_diretoria(auth.uid(), diretoria_id, scope))
  WITH CHECK (public.can_access_diretoria(auth.uid(), diretoria_id, scope));
CREATE TRIGGER diretoria_items_updated BEFORE UPDATE ON public.diretoria_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();