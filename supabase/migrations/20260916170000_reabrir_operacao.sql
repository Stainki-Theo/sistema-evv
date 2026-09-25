-- Reabre uma operação de forma atômica: retira os lançamentos consolidados e
-- deixa a planilha pronta para correção e novo encerramento.
CREATE OR REPLACE FUNCTION public.reopen_operation(_op_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  marker record;
  payload jsonb;
  target_profile uuid;
  credited_minutes integer;
  affected_profiles integer := 0;
  removed_entries integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_ops(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para reabrir esta operação.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.app_settings
    WHERE key = 'operation_closed:' || _op_date::text AND value = 'true'
  ) THEN
    RAISE EXCEPTION 'Esta operação não está encerrada.';
  END IF;

  FOR marker IN
    SELECT key, value
    FROM public.app_settings
    WHERE key LIKE 'flight_credit:' || _op_date::text || ':%'
    FOR UPDATE
  LOOP
    BEGIN
      payload := marker.value::jsonb;
      target_profile := substr(
        marker.key,
        length('flight_credit:' || _op_date::text || ':') + 1
      )::uuid;
      credited_minutes := greatest(0, coalesce((payload->>'minutes')::integer, 0));
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Crédito de voo inválido na operação de %.', _op_date;
    END;

    UPDATE public.profiles
    SET flight_minutes = greatest(0, coalesce(flight_minutes, 0) - credited_minutes)
    WHERE id = target_profile;
    affected_profiles := affected_profiles + 1;
  END LOOP;

  WITH removed AS (
    DELETE FROM public.pitocador_entries pe
    USING public.annotator_flights af
    WHERE pe.flight_id = af.id AND af.op_date = _op_date
    RETURNING pe.id
  )
  SELECT count(*)::integer INTO removed_entries FROM removed;

  DELETE FROM public.app_settings
  WHERE key LIKE 'flight_credit:' || _op_date::text || ':%'
     OR key LIKE 'flight_credit_notice:%:' || _op_date::text;

  INSERT INTO public.app_settings (key, value)
  VALUES ('operation_closed:' || _op_date::text, 'false')
  ON CONFLICT (key) DO UPDATE SET value = excluded.value;

  RETURN jsonb_build_object(
    'profiles_reversed', affected_profiles,
    'pitocador_entries_removed', removed_entries
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_operation(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_operation(date) TO authenticated, service_role;

