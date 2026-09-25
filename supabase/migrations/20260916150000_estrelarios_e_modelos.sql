ALTER TABLE public.aircraft
  ADD COLUMN IF NOT EXISTS modelo text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.can_issue_estrelarios(_user_id uuid, _op_date date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_manage_ops(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.duty_roster d
      WHERE d.op_date = _op_date
        AND d.profile_id = _user_id
        AND d.funcao IN (
          'Chefe de Pista (Manhã)', 'Chefe de Pista (Tarde)',
          'Sombra (Manhã)', 'Sombra (Tarde)'
        )
    )
$$;

REVOKE ALL ON FUNCTION public.can_issue_estrelarios(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_issue_estrelarios(uuid, date) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.estrelarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  reason text NOT NULL,
  op_date date NOT NULL DEFAULT CURRENT_DATE,
  issued_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  issued_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT estrelarios_amount_range CHECK (amount > 0 AND amount <= 30000),
  CONSTRAINT estrelarios_reason_required CHECK (length(trim(reason)) > 0)
);

CREATE OR REPLACE FUNCTION public.enforce_estrelarios_daily_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total_day integer;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total_day
  FROM public.estrelarios
  WHERE recipient_id = NEW.recipient_id
    AND op_date = NEW.op_date
    AND id <> NEW.id;
  IF total_day + NEW.amount > 30000 THEN
    RAISE EXCEPTION 'O teto diário por tripulante é de 30.000 estrelários.';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS estrelarios_daily_limit ON public.estrelarios;
CREATE TRIGGER estrelarios_daily_limit
  BEFORE INSERT OR UPDATE ON public.estrelarios
  FOR EACH ROW EXECUTE FUNCTION public.enforce_estrelarios_daily_limit();

DROP TRIGGER IF EXISTS estrelarios_updated ON public.estrelarios;
CREATE TRIGGER estrelarios_updated BEFORE UPDATE ON public.estrelarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS estrelarios_recipient_date_idx
  ON public.estrelarios (recipient_id, op_date DESC);
CREATE INDEX IF NOT EXISTS estrelarios_date_idx ON public.estrelarios (op_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estrelarios TO authenticated;
GRANT ALL ON public.estrelarios TO service_role;
ALTER TABLE public.estrelarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "estrelarios_select_private" ON public.estrelarios;
CREATE POLICY "estrelarios_select_private" ON public.estrelarios FOR SELECT TO authenticated
  USING (
    recipient_id = auth.uid()
    OR issued_by = auth.uid()
    OR public.can_manage_ops(auth.uid())
  );
DROP POLICY IF EXISTS "estrelarios_insert_authorized" ON public.estrelarios;
CREATE POLICY "estrelarios_insert_authorized" ON public.estrelarios FOR INSERT TO authenticated
  WITH CHECK (
    issued_by = auth.uid()
    AND public.can_issue_estrelarios(auth.uid(), op_date)
  );
DROP POLICY IF EXISTS "estrelarios_update_authorized" ON public.estrelarios;
CREATE POLICY "estrelarios_update_authorized" ON public.estrelarios FOR UPDATE TO authenticated
  USING (issued_by = auth.uid() OR public.can_manage_ops(auth.uid()))
  WITH CHECK (issued_by = auth.uid() OR public.can_manage_ops(auth.uid()));
DROP POLICY IF EXISTS "estrelarios_delete_authorized" ON public.estrelarios;
CREATE POLICY "estrelarios_delete_authorized" ON public.estrelarios FOR DELETE TO authenticated
  USING (issued_by = auth.uid() OR public.can_manage_ops(auth.uid()));

CREATE OR REPLACE FUNCTION public.estrelarios_estatistica(_from date, _to date)
RETURNS TABLE(op_date date, total bigint, lancamentos bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.op_date, SUM(e.amount)::bigint, COUNT(*)::bigint
  FROM public.estrelarios e
  WHERE e.op_date BETWEEN _from AND _to
  GROUP BY e.op_date
  ORDER BY e.op_date
$$;

REVOKE ALL ON FUNCTION public.estrelarios_estatistica(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.estrelarios_estatistica(date, date) TO authenticated, service_role;
