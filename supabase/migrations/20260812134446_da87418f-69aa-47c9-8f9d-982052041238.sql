-- Perfis / Efetivo
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gaivota text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS esquadrao text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cargo text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS diretoria text NOT NULL DEFAULT '';

-- Meteorologia: campos do briefing real
ALTER TABLE public.weather_observations
  ADD COLUMN IF NOT EXISTS temp_max text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tic_temp text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tic_time text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS solar_hours text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rain_confidence text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fog_obs text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS wind_period_start text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS wind_period_end text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS wind_obs text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'Meteoblue',
  ADD COLUMN IF NOT EXISTS updated_by_name text NOT NULL DEFAULT '';

-- Diretorias configuráveis
CREATE TABLE IF NOT EXISTS public.diretorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diretorias TO authenticated;
GRANT ALL ON public.diretorias TO service_role;
ALTER TABLE public.diretorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all diretorias" ON public.diretorias FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER diretorias_updated BEFORE UPDATE ON public.diretorias FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.diretorias (nome, sort_order) VALUES ('Material', 1), ('Segurança de Voo', 2), ('Pessoal', 3)
  ON CONFLICT (nome) DO NOTHING;

-- RELPREVs anteriores (permanentes)
CREATE TABLE IF NOT EXISTS public.relprevs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  relprev_date date NOT NULL DEFAULT CURRENT_DATE,
  summary text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Outros',
  keywords text NOT NULL DEFAULT '',
  file_path text NOT NULL DEFAULT '',
  file_name text NOT NULL DEFAULT '',
  external_url text NOT NULL DEFAULT '',
  created_by uuid,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relprevs TO authenticated;
GRANT ALL ON public.relprevs TO service_role;
ALTER TABLE public.relprevs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all relprevs" ON public.relprevs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER relprevs_updated BEFORE UPDATE ON public.relprevs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Documentos (biblioteca permanente)
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Outros',
  doc_date date NOT NULL DEFAULT CURRENT_DATE,
  keywords text NOT NULL DEFAULT '',
  file_path text NOT NULL DEFAULT '',
  file_name text NOT NULL DEFAULT '',
  external_url text NOT NULL DEFAULT '',
  created_by uuid,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all documents" ON public.documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER documents_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS relprevs_date_idx ON public.relprevs (relprev_date DESC);
CREATE INDEX IF NOT EXISTS documents_category_idx ON public.documents (category, doc_date DESC);