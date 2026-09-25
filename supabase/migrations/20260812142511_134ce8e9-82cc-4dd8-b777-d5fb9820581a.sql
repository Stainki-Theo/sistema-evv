-- 1. Perfis: campos operacionais permanentes + situação da conta
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS posto text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tri text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fase text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS missao text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS proxima_missao text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ops integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pso integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opr_dg text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS opr_duo text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS opr_cs text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ATIVO';

-- 2. Meteorologia: chance de neblina
ALTER TABLE public.weather_observations
  ADD COLUMN IF NOT EXISTS fog_chance text NOT NULL DEFAULT '';

-- 3. Fases operacionais editáveis
CREATE TABLE IF NOT EXISTS public.fases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  cor text NOT NULL DEFAULT 'info',
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fases TO authenticated;
GRANT ALL ON public.fases TO service_role;
ALTER TABLE public.fases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth all fases" ON public.fases;
CREATE POLICY "auth all fases" ON public.fases FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS fases_updated ON public.fases;
CREATE TRIGGER fases_updated BEFORE UPDATE ON public.fases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.fases (nome, cor, sort_order) VALUES
  ('Checador DUO/DG', 'danger', 1),
  ('Checador', 'danger', 2),
  ('Instrutor DG', 'warning', 3),
  ('Instrutor DUO', 'warning', 4),
  ('Nacele Traseira', 'warning', 5),
  ('Formação de Instrutor', 'info', 6),
  ('Piloto Operacional', 'success', 7),
  ('Piloto Básico', 'neutral', 8)
ON CONFLICT (nome) DO NOTHING;

-- 4. Disponibilidade: semanas de operação
CREATE TABLE IF NOT EXISTS public.availability_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL UNIQUE,
  week_end date NOT NULL,
  days date[] NOT NULL DEFAULT '{}',
  open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_weeks TO authenticated;
GRANT ALL ON public.availability_weeks TO service_role;
ALTER TABLE public.availability_weeks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth all availability_weeks" ON public.availability_weeks;
CREATE POLICY "auth all availability_weeks" ON public.availability_weeks FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS availability_weeks_updated ON public.availability_weeks;
CREATE TRIGGER availability_weeks_updated BEFORE UPDATE ON public.availability_weeks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Disponibilidade: respostas por dia
CREATE TABLE IF NOT EXISTS public.availability_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES public.availability_weeks(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  op_date date NOT NULL,
  status text NOT NULL DEFAULT 'NAO_RESPONDEU',
  observacao text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (week_id, profile_id, op_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_entries TO authenticated;
GRANT ALL ON public.availability_entries TO service_role;
ALTER TABLE public.availability_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "availability read" ON public.availability_entries;
CREATE POLICY "availability read" ON public.availability_entries FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "availability own write" ON public.availability_entries;
CREATE POLICY "availability own write" ON public.availability_entries FOR ALL TO authenticated
  USING (profile_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (profile_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'));
DROP TRIGGER IF EXISTS availability_entries_updated ON public.availability_entries;
CREATE TRIGGER availability_entries_updated BEFORE UPDATE ON public.availability_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Segurança: MEMBRO edita dados operacionais do efetivo, mas nunca situação de conta
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  full_name, war_name, turma, funcao, nivel_operacional, flight_minutes, observacao,
  gaivota, esquadrao, cargo, diretoria, posto, tri, fase, missao, proxima_missao,
  ops, pso, opr_dg, opr_duo, opr_cs, updated_at
) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_operacional" ON public.profiles;
CREATE POLICY "profiles_update_operacional" ON public.profiles FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- 7. Helper de administrador
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'administrador')
$$;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

-- 8. Novos usuários criados pelo painel entram como MEMBRO
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, war_name, turma, funcao, email, posto, tri, gaivota, esquadrao, diretoria)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    COALESCE(NEW.raw_user_meta_data->>'war_name',''),
    COALESCE(NEW.raw_user_meta_data->>'turma',''),
    COALESCE(NEW.raw_user_meta_data->>'funcao',''),
    COALESCE(NEW.email,''),
    COALESCE(NEW.raw_user_meta_data->>'posto',''),
    COALESCE(NEW.raw_user_meta_data->>'tri',''),
    COALESCE(NEW.raw_user_meta_data->>'gaivota',''),
    COALESCE(NEW.raw_user_meta_data->>'esquadrao',''),
    COALESCE(NEW.raw_user_meta_data->>'diretoria','')
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id,'usuario') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

-- 9. Concede ADMIN ao usuário histórico somente quando ele existir neste projeto.
-- Em instalações novas, o primeiro administrador é criado depois da migração.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'administrador'::public.app_role
FROM auth.users
WHERE id = '68b6b900-8ae3-4f5e-b125-167bef5f920f'::uuid
ON CONFLICT (user_id, role) DO NOTHING;
