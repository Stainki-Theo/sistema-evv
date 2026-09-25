CREATE TABLE public.mission_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT '',
  cor text NOT NULL DEFAULT '#475569',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mission_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.mission_categories TO authenticated;
GRANT ALL ON public.mission_categories TO service_role;
ALTER TABLE public.mission_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mission_categories_read" ON public.mission_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "mission_categories_write" ON public.mission_categories FOR ALL TO authenticated USING (public.can_manage_ops(auth.uid())) WITH CHECK (public.can_manage_ops(auth.uid()));
CREATE TRIGGER mission_categories_updated BEFORE UPDATE ON public.mission_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.mission_category_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  missao_base text NOT NULL UNIQUE,
  category_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mission_category_overrides TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.mission_category_overrides TO authenticated;
GRANT ALL ON public.mission_category_overrides TO service_role;
ALTER TABLE public.mission_category_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mission_overrides_read" ON public.mission_category_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "mission_overrides_write" ON public.mission_category_overrides FOR ALL TO authenticated USING (public.can_manage_ops(auth.uid())) WITH CHECK (public.can_manage_ops(auth.uid()));
CREATE TRIGGER mission_overrides_updated BEFORE UPDATE ON public.mission_category_overrides FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.operational_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.operational_levels TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.operational_levels TO authenticated;
GRANT ALL ON public.operational_levels TO service_role;
ALTER TABLE public.operational_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operational_levels_read" ON public.operational_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "operational_levels_write" ON public.operational_levels FOR ALL TO authenticated USING (public.can_manage_ops(auth.uid())) WITH CHECK (public.can_manage_ops(auth.uid()));
CREATE TRIGGER operational_levels_updated BEFORE UPDATE ON public.operational_levels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.mission_categories (key, label, cor, sort_order) VALUES
  ('PS', 'Pré-solo (PS)', '#1d4ed8', 1),
  ('RPS', 'Revalidação (RPS)', '#0e7490', 2),
  ('AP', 'Aperfeiçoamento (AP)', '#15803d', 3),
  ('PANE', 'PANE', '#b91c1c', 4),
  ('VT', 'Voo de travessia (VT)', '#7c3aed', 5),
  ('X', 'Cross-country (X)', '#a16207', 6),
  ('OUTRA', 'Outras', '#475569', 99)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.operational_levels (nome, sort_order)
SELECT DISTINCT btrim(nivel_operacional), 10
FROM public.profiles
WHERE btrim(coalesce(nivel_operacional,'')) <> ''
ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.operational_levels (nome, sort_order) VALUES
  ('Piloto Básico', 1),
  ('Piloto Operacional', 2),
  ('Instrutor', 3)
ON CONFLICT (nome) DO NOTHING;