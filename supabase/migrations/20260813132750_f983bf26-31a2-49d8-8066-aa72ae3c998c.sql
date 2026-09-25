-- 1. Planilha do anotador: resultado + vínculo com integrante
ALTER TABLE public.annotator_flights
  ADD COLUMN IF NOT EXISTS resultado text NOT NULL DEFAULT 'PENDENTE',
  ADD COLUMN IF NOT EXISTS al_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Escala: integrante, origem e sugestão pendente
ALTER TABLE public.flight_schedule
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'AUTOMATICO',
  ADD COLUMN IF NOT EXISTS missao_sugerida text NOT NULL DEFAULT '';

-- 3. Sequência operacional configurável
CREATE TABLE IF NOT EXISTS public.mission_sequence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL DEFAULT 'PS',
  missao text NOT NULL UNIQUE,
  proxima text NOT NULL DEFAULT '',
  pane boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_sequence TO authenticated;
GRANT ALL ON public.mission_sequence TO service_role;
ALTER TABLE public.mission_sequence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mission_sequence_read" ON public.mission_sequence;
CREATE POLICY "mission_sequence_read" ON public.mission_sequence
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "mission_sequence_admin" ON public.mission_sequence;
CREATE POLICY "mission_sequence_admin" ON public.mission_sequence
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP TRIGGER IF EXISTS mission_sequence_updated ON public.mission_sequence;
CREATE TRIGGER mission_sequence_updated BEFORE UPDATE ON public.mission_sequence
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.mission_sequence (categoria, missao, proxima, pane, sort_order) VALUES
  ('PS','PS-01','PS-02',false,1),
  ('PS','PS-02','PS-03',false,2),
  ('PS','PS-03','PS-04',false,3),
  ('PS','PS-04','PS-05',false,4),
  ('PS','PS-05','PS-06',false,5),
  ('PS','PS-06','PS-07',false,6),
  ('PS','PS-07','PS-08',false,7),
  ('PS','PS-08','PS-09',false,8),
  ('PS','PS-09','PS-10',false,9),
  ('PS','PS-10','PS-11',false,10),
  ('PS','PS-11','PS-12',false,11),
  ('PS','PS-12','PS-13',false,12),
  ('PS','PS-13','PS-14',false,13),
  ('PS','PS-14','PS-15',false,14),
  ('PS','PS-15','PS-16',true,15),
  ('PS','PS-16','PS-17',true,16),
  ('PS','PS-17','PS-18',true,17),
  ('PS','PS-18','PS-19',true,18),
  ('PS','PS-19','X1',false,19),
  ('X','X1','',false,20),
  ('RPS','RPS-02','RPS-01',true,21),
  ('RPS','RPS-01','',false,22),
  ('AP','AP','',false,30)
ON CONFLICT (missao) DO NOTHING;

-- 4. Histórico de progressão
CREATE TABLE IF NOT EXISTS public.progression_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  profile_tag text NOT NULL DEFAULT '',
  op_date date NOT NULL,
  missao text NOT NULL DEFAULT '',
  resultado text NOT NULL DEFAULT 'PENDENTE',
  proxima_missao text NOT NULL DEFAULT '',
  registrado_por text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progression_log TO authenticated;
GRANT ALL ON public.progression_log TO service_role;
ALTER TABLE public.progression_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "progression_log_auth" ON public.progression_log;
CREATE POLICY "progression_log_auth" ON public.progression_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS progression_log_profile_idx ON public.progression_log (profile_id, created_at DESC);

-- 5. Avisos e segurança: escopo persistente/temporário + arquivamento
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'PERSISTENTE',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.safety_entries
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'PERSISTENTE',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- 6. Registro histórico de contas excluídas
CREATE TABLE IF NOT EXISTS public.deleted_members (
  id uuid PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  war_name text NOT NULL DEFAULT '',
  tri text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  esquadrao text NOT NULL DEFAULT '',
  posto text NOT NULL DEFAULT '',
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deleted_by text NOT NULL DEFAULT ''
);
GRANT SELECT ON public.deleted_members TO authenticated;
GRANT ALL ON public.deleted_members TO service_role;
ALTER TABLE public.deleted_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deleted_members_read" ON public.deleted_members;
CREATE POLICY "deleted_members_read" ON public.deleted_members
  FOR SELECT TO authenticated USING (true);
