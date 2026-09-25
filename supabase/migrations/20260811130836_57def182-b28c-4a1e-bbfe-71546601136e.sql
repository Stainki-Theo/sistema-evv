
CREATE TYPE public.app_role AS ENUM ('administrador','operador','usuario');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  war_name text NOT NULL DEFAULT '',
  turma text NOT NULL DEFAULT '',
  funcao text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('administrador','operador'))
$$;

CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'administrador')) WITH CHECK (public.has_role(auth.uid(),'administrador'));

CREATE POLICY "user_roles_select_auth" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'administrador')) WITH CHECK (public.has_role(auth.uid(),'administrador'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, war_name, turma, funcao, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    COALESCE(NEW.raw_user_meta_data->>'war_name',''),
    COALESCE(NEW.raw_user_meta_data->>'turma',''),
    COALESCE(NEW.raw_user_meta_data->>'funcao',''),
    COALESCE(NEW.email,'')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id,'usuario') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- funções do serviço do dia
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_select_auth" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_admin_all" ON public.roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'administrador')) WITH CHECK (public.has_role(auth.uid(),'administrador'));

CREATE TABLE public.operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  op_date date NOT NULL UNIQUE,
  local text NOT NULL DEFAULT '',
  pista text NOT NULL DEFAULT '',
  cabeceira text NOT NULL DEFAULT '',
  area text NOT NULL DEFAULT '',
  briefing_time text NOT NULL DEFAULT '',
  start_time text NOT NULL DEFAULT '',
  end_time text NOT NULL DEFAULT '',
  responsavel text NOT NULL DEFAULT '',
  instrutores text NOT NULL DEFAULT '',
  rebocadores text NOT NULL DEFAULT '',
  planadores text NOT NULL DEFAULT '',
  radio_freq text NOT NULL DEFAULT '',
  objetivo text NOT NULL DEFAULT '',
  restricoes text NOT NULL DEFAULT '',
  observacoes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'NAO_INICIADA',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operations TO authenticated;
GRANT ALL ON public.operations TO service_role;
ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operations_select_auth" ON public.operations FOR SELECT TO authenticated USING (true);
CREATE POLICY "operations_staff_all" ON public.operations FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER operations_updated_at BEFORE UPDATE ON public.operations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.operation_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.operations(id) ON DELETE CASCADE,
  role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  role_name text NOT NULL DEFAULT '',
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  person_name text NOT NULL DEFAULT '',
  time_start text NOT NULL DEFAULT '',
  time_end text NOT NULL DEFAULT '',
  observacao text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operation_roles TO authenticated;
GRANT ALL ON public.operation_roles TO service_role;
ALTER TABLE public.operation_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operation_roles_select_auth" ON public.operation_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "operation_roles_staff_all" ON public.operation_roles FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.weather_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.operations(id) ON DELETE CASCADE,
  observed_at text NOT NULL DEFAULT '',
  wind_dir text NOT NULL DEFAULT '',
  wind_speed text NOT NULL DEFAULT '',
  wind_gust text NOT NULL DEFAULT '',
  crosswind text NOT NULL DEFAULT '',
  headwind text NOT NULL DEFAULT '',
  temperature text NOT NULL DEFAULT '',
  dewpoint text NOT NULL DEFAULT '',
  qnh text NOT NULL DEFAULT '',
  visibility text NOT NULL DEFAULT '',
  humidity text NOT NULL DEFAULT '',
  cloud_cover text NOT NULL DEFAULT '',
  cloud_base text NOT NULL DEFAULT '',
  cloud_type text NOT NULL DEFAULT '',
  cloud_obs text NOT NULL DEFAULT '',
  thermals text NOT NULL DEFAULT '',
  thermals_strength text NOT NULL DEFAULT '',
  thermals_ceiling text NOT NULL DEFAULT '',
  cumulus_cover text NOT NULL DEFAULT '',
  rain_chance text NOT NULL DEFAULT '',
  turbulence text NOT NULL DEFAULT '',
  general_conditions text NOT NULL DEFAULT '',
  classification text NOT NULL DEFAULT 'REGULAR',
  analysis text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weather_reports TO authenticated;
GRANT ALL ON public.weather_reports TO service_role;
ALTER TABLE public.weather_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weather_select_auth" ON public.weather_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "weather_staff_all" ON public.weather_reports FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL UNIQUE REFERENCES public.operations(id) ON DELETE CASCADE,
  sections jsonb NOT NULL DEFAULT '{}'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  updated_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.briefings TO authenticated;
GRANT ALL ON public.briefings TO service_role;
ALTER TABLE public.briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "briefings_select_auth" ON public.briefings FOR SELECT TO authenticated USING (true);
CREATE POLICY "briefings_staff_all" ON public.briefings FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER briefings_updated_at BEFORE UPDATE ON public.briefings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.briefing_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id uuid NOT NULL REFERENCES public.briefings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name text NOT NULL DEFAULT '',
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (briefing_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.briefing_acknowledgements TO authenticated;
GRANT ALL ON public.briefing_acknowledgements TO service_role;
ALTER TABLE public.briefing_acknowledgements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ack_select_auth" ON public.briefing_acknowledgements FOR SELECT TO authenticated USING (true);
CREATE POLICY "ack_insert_own" ON public.briefing_acknowledgements FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "ack_delete_own" ON public.briefing_acknowledgements FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'administrador'));

CREATE TABLE public.aircraft (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model text NOT NULL,
  registration text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'planador',
  status text NOT NULL DEFAULT 'DISPONIVEL',
  observacao text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aircraft TO authenticated;
GRANT ALL ON public.aircraft TO service_role;
ALTER TABLE public.aircraft ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aircraft_select_auth" ON public.aircraft FOR SELECT TO authenticated USING (true);
CREATE POLICY "aircraft_staff_all" ON public.aircraft FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER aircraft_updated_at BEFORE UPDATE ON public.aircraft FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.flight_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.operations(id) ON DELETE CASCADE,
  ordem int NOT NULL DEFAULT 1,
  aluno text NOT NULL DEFAULT '',
  instrutor text NOT NULL DEFAULT '',
  aircraft_id uuid REFERENCES public.aircraft(id) ON DELETE SET NULL,
  planador text NOT NULL DEFAULT '',
  objetivo text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'AGUARDANDO',
  takeoff_at timestamptz,
  landing_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flight_queue TO authenticated;
GRANT ALL ON public.flight_queue TO service_role;
ALTER TABLE public.flight_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flight_queue_select_auth" ON public.flight_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "flight_queue_staff_all" ON public.flight_queue FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid REFERENCES public.operations(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'INFORMACAO',
  message text NOT NULL,
  valid_until timestamptz,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notices TO authenticated;
GRANT ALL ON public.notices TO service_role;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notices_select_auth" ON public.notices FOR SELECT TO authenticated USING (true);
CREATE POLICY "notices_staff_all" ON public.notices FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.operation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid REFERENCES public.operations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name text NOT NULL DEFAULT '',
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.operation_logs TO authenticated;
GRANT ALL ON public.operation_logs TO service_role;
ALTER TABLE public.operation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs_select_auth" ON public.operation_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "logs_insert_auth" ON public.operation_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ==== dados de demonstração ====
INSERT INTO public.roles (name, sort_order) VALUES
  ('Chefe da operação',10),('Instrutor',20),('Piloto rebocador',30),('Aluno em voo',40),
  ('Ponta de cabo',50),('Anotador',60),('Operador de pista',70),('Material',80),('Rádio',90),('Apoio',100);

INSERT INTO public.aircraft (model, registration, type, status, observacao) VALUES
  ('DG-1000','8121','planador','EM_VOO',''),
  ('DG-1000','8122','planador','DISPONIVEL',''),
  ('ASK-21','8130','planador','EM_PREPARACAO',''),
  ('Ipanema','2145','rebocador','DISPONIVEL',''),
  ('Ipanema','2146','rebocador','MANUTENCAO','Revisão de 50h');

INSERT INTO public.operations (op_date, local, pista, cabeceira, area, briefing_time, start_time, end_time, responsavel, instrutores, rebocadores, planadores, radio_freq, objetivo, restricoes, observacoes, status)
VALUES (CURRENT_DATE,'Campo de Voo a Vela','14/32','14','Setor Norte — até 8 NM','07:30','08:00','12:00','Maj ANDRADE','Cap ROMANI, 1º Ten STAINKI','Cap MOURA','DG-1000 8121, DG-1000 8122, ASK-21 8130','130.05 MHz','Instrução de lançamento, circuito de tráfego e pouso.','Operação limitada até 15 kt de vento cruzado.','Reboque padrão até 2.000 ft AGL.','EM_OPERACAO');

INSERT INTO public.operation_roles (operation_id, role_id, role_name, person_name, time_start, time_end, observacao, sort_order)
SELECT o.id, r.id, r.name, v.person, v.ts, v.te, v.obs, r.sort_order
FROM public.operations o
JOIN (VALUES
  ('Chefe da operação','ANDRADE','08:00','12:00',''),
  ('Instrutor','ROMANI','08:00','12:00',''),
  ('Piloto rebocador','MOURA','08:00','12:00',''),
  ('Ponta de cabo','STAINKI','08:00','10:00','Substituído às 10:00'),
  ('Ponta de cabo','ROMANI','10:00','12:00',''),
  ('Anotador','LIMA','08:00','12:00',''),
  ('Operador de pista','COSTA','08:00','12:00',''),
  ('Rádio','FARIAS','08:00','12:00',''),
  ('Material','SOUZA','08:00','12:00',''),
  ('Apoio','MENDES','08:00','12:00','')
) AS v(role, person, ts, te, obs) ON true
JOIN public.roles r ON r.name = v.role
WHERE o.op_date = CURRENT_DATE;

INSERT INTO public.weather_reports (operation_id, observed_at, wind_dir, wind_speed, wind_gust, crosswind, headwind, temperature, dewpoint, qnh, visibility, humidity, cloud_cover, cloud_base, cloud_type, cloud_obs, thermals, thermals_strength, thermals_ceiling, cumulus_cover, rain_chance, turbulence, general_conditions, classification, analysis, created_by_name)
SELECT id,'09:00','140','08','12','4','7','27','14','1018','10 km','45%','FEW','4.500 ft','Cumulus','Cumulus isolados a barlavento','Sim','Moderadas (2 m/s)','5.000 ft','2/8','Baixa','Leve a moderada','Boas condições para instrução','BOA','Vento alinhado com a cabeceira 14, térmicas iniciando às 09:30 com topo previsto em 5.000 ft. Sem previsão de precipitação até 13:00.','ROMANI'
FROM public.operations WHERE op_date = CURRENT_DATE;

INSERT INTO public.briefings (operation_id, sections, published, published_at, updated_by_name)
SELECT id, jsonb_build_object(
  'situacao_geral','Operação de instrução com 3 planadores e 1 rebocador disponíveis.',
  'meteorologia','Vento 140/08 kt, rajadas 12 kt, térmicas moderadas a partir das 09:30.',
  'pista_area','Pista 14/32 em uso, cabeceira 14. Área de operação Setor Norte até 8 NM.',
  'procedimentos','Reboque até 2.000 ft AGL, liberação sobre o setor norte, circuito padrão à esquerda.',
  'sequencia','Conforme quadro de sequência de voos.',
  'seguranca','Atenção ao tráfego de superfície e ao posicionamento do pessoal na ponta de cabo.',
  'comunicacoes','Frequência 130.05 MHz. Chamada padrão: indicativo + intenção.',
  'situacoes_especiais','Em caso de rompimento de cabo abaixo de 300 ft, pouso reto à frente.',
  'observacoes_finais','Encerramento previsto às 12:00.'
), true, now(), 'ANDRADE'
FROM public.operations WHERE op_date = CURRENT_DATE;

INSERT INTO public.flight_queue (operation_id, ordem, aluno, instrutor, planador, objetivo, status, takeoff_at)
SELECT o.id, v.ordem, v.aluno, v.instrutor, v.planador, v.objetivo, v.status,
  CASE WHEN v.status = 'EM_VOO' THEN now() - interval '12 minutes' ELSE NULL END
FROM public.operations o
JOIN (VALUES
  (1,'SILVA','ROMANI','DG-1000 8121','Circuito de tráfego','EM_VOO'),
  (2,'PEREIRA','ROMANI','DG-1000 8122','Lançamento e pouso','PRONTO'),
  (3,'ALMEIDA','STAINKI','ASK-21 8130','Instrução de pouso','PREPARANDO'),
  (4,'CARVALHO','STAINKI','DG-1000 8121','Voo solo supervisionado','AGUARDANDO'),
  (5,'DIAS','ROMANI','DG-1000 8122','Circuito de tráfego','AGUARDANDO')
) AS v(ordem, aluno, instrutor, planador, objetivo, status) ON true
WHERE o.op_date = CURRENT_DATE;

INSERT INTO public.notices (operation_id, category, message, valid_until, created_by_name)
SELECT id,'ATENCAO','Mudança da cabeceira para pista 20 prevista após as 11:00.', now() + interval '6 hours','ANDRADE' FROM public.operations WHERE op_date = CURRENT_DATE
UNION ALL
SELECT id,'SEGURANCA','Reforçar afastamento do pessoal durante o esticamento do cabo.', now() + interval '8 hours','ROMANI' FROM public.operations WHERE op_date = CURRENT_DATE
UNION ALL
SELECT id,'INFORMACAO','Café e hidratação disponíveis no hangar 2.', now() + interval '8 hours','LIMA' FROM public.operations WHERE op_date = CURRENT_DATE;

INSERT INTO public.operation_logs (operation_id, user_name, action)
SELECT id,'STAINKI','alterou DG-1000 8121 de DISPONÍVEL para EM VOO' FROM public.operations WHERE op_date = CURRENT_DATE
UNION ALL
SELECT id,'ANDRADE','publicou o briefing da operação' FROM public.operations WHERE op_date = CURRENT_DATE;
