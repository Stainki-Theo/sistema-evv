CREATE OR REPLACE FUNCTION public.guard_instrutor_flag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.instrutor IS DISTINCT FROM OLD.instrutor
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'administrador') THEN
    RAISE EXCEPTION 'Somente a administração pode alterar a condição de instrutor.';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS profiles_guard_instrutor ON public.profiles;
CREATE TRIGGER profiles_guard_instrutor BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_instrutor_flag();