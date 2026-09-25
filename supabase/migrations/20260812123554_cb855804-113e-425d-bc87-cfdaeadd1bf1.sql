-- cleanup
DROP TABLE IF EXISTS public.briefing_acknowledgements CASCADE;
DROP TABLE IF EXISTS public.briefings CASCADE;
DROP TABLE IF EXISTS public.flight_queue CASCADE;
DROP TABLE IF EXISTS public.operation_roles CASCADE;
DROP TABLE IF EXISTS public.operation_logs CASCADE;
DROP TABLE IF EXISTS public.weather_reports CASCADE;
DROP TABLE IF EXISTS public.notices CASCADE;
DROP TABLE IF EXISTS public.aircraft CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;
DROP TABLE IF EXISTS public.operations CASCADE;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nivel_operacional text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS flight_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observacao text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- 1. operation days (briefing time)
CREATE TABLE public.op_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  op_date date NOT NULL UNIQUE,
  briefing_time text NOT NULL DEFAULT '07:30',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_days TO authenticated;
GRANT ALL ON public.op_days TO service_role;
ALTER TABLE public.op_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read op_days" ON public.op_days FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write op_days" ON public.op_days FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER op_days_updated BEFORE UPDATE ON public.op_days FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. flight schedule
CREATE TABLE public.flight_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  op_date date NOT NULL,
  time_planned text NOT NULL DEFAULT '',
  aluno text NOT NULL DEFAULT '',
  instrutor text NOT NULL DEFAULT '',
  missao text NOT NULL DEFAULT '',
  observacao text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flight_schedule TO authenticated;
GRANT ALL ON public.flight_schedule TO service_role;
ALTER TABLE public.flight_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all flight_schedule" ON public.flight_schedule FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX flight_schedule_date_idx ON public.flight_schedule (op_date, sort_order);
CREATE TRIGGER flight_schedule_updated BEFORE UPDATE ON public.flight_schedule FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. duty roster (funcoes)
CREATE TABLE public.duty_roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  op_date date NOT NULL,
  funcao text NOT NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  responsavel text NOT NULL DEFAULT '',
  observacao text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duty_roster TO authenticated;
GRANT ALL ON public.duty_roster TO service_role;
ALTER TABLE public.duty_roster ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all duty_roster" ON public.duty_roster FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX duty_roster_date_idx ON public.duty_roster (op_date, sort_order);
CREATE TRIGGER duty_roster_updated BEFORE UPDATE ON public.duty_roster FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. weather observations
CREATE TABLE public.weather_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  op_date date NOT NULL,
  observed_time text NOT NULL DEFAULT '',
  wind_dir text NOT NULL DEFAULT '',
  wind_speed text NOT NULL DEFAULT '',
  wind_gust text NOT NULL DEFAULT '',
  temperature text NOT NULL DEFAULT '',
  dewpoint text NOT NULL DEFAULT '',
  humidity text NOT NULL DEFAULT '',
  qnh text NOT NULL DEFAULT '',
  visibility text NOT NULL DEFAULT '',
  fog text NOT NULL DEFAULT '',
  rain_chance text NOT NULL DEFAULT '',
  precipitation text NOT NULL DEFAULT '',
  turbulence text NOT NULL DEFAULT '',
  cloud_cover text NOT NULL DEFAULT '',
  cloud_base text NOT NULL DEFAULT '',
  ceiling text NOT NULL DEFAULT '',
  cloud_type text NOT NULL DEFAULT '',
  cloud_layers text NOT NULL DEFAULT '',
  tick text NOT NULL DEFAULT '',
  thermals_top text NOT NULL DEFAULT '',
  thermals_strength text NOT NULL DEFAULT '',
  thermal_condition text NOT NULL DEFAULT '',
  solar_radiation text NOT NULL DEFAULT '',
  cumulus_cover text NOT NULL DEFAULT '',
  thermals_obs text NOT NULL DEFAULT '',
  sunrise text NOT NULL DEFAULT '',
  sunset text NOT NULL DEFAULT '',
  last_glider_ground text NOT NULL DEFAULT '',
  classification text NOT NULL DEFAULT 'BOA',
  analysis text NOT NULL DEFAULT '',
  extra text NOT NULL DEFAULT '',
  created_by uuid,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weather_observations TO authenticated;
GRANT ALL ON public.weather_observations TO service_role;
ALTER TABLE public.weather_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all weather_observations" ON public.weather_observations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX weather_observations_date_idx ON public.weather_observations (op_date, created_at DESC);
CREATE TRIGGER weather_observations_updated BEFORE UPDATE ON public.weather_observations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. announcements (avisos)
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  op_date date NOT NULL DEFAULT current_date,
  time_ref text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'INFORMACAO',
  responsavel text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all announcements" ON public.announcements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX announcements_date_idx ON public.announcements (op_date, created_at DESC);
CREATE TRIGGER announcements_updated BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. safety entries
CREATE TABLE public.safety_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  op_date date NOT NULL DEFAULT current_date,
  kind text NOT NULL DEFAULT 'AVISO',
  time_ref text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  responsavel text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_entries TO authenticated;
GRANT ALL ON public.safety_entries TO service_role;
ALTER TABLE public.safety_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all safety_entries" ON public.safety_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX safety_entries_date_idx ON public.safety_entries (op_date, created_at DESC);
CREATE TRIGGER safety_entries_updated BEFORE UPDATE ON public.safety_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. app settings (RELPREV link)
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all app_settings" ON public.app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER app_settings_updated BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.app_settings (key, value) VALUES ('relprev_url', '') ON CONFLICT (key) DO NOTHING;

INSERT INTO public.op_days (op_date, briefing_time) VALUES (current_date, '07:30') ON CONFLICT (op_date) DO NOTHING;