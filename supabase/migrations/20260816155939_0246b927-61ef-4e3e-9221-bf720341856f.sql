-- ---------- Perfil: foto, IN pessoal, instrutor ----------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_path text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS in_pessoal_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS instrutor boolean NOT NULL DEFAULT false;

-- ---------- Permissão de instrução ----------
CREATE OR REPLACE FUNCTION public.is_instrutor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.instrutor = true)
$$;

CREATE OR REPLACE FUNCTION public.can_view_pitocador(_user_id uuid, _target_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id = _target_id
      OR public.has_role(_user_id, 'administrador')
      OR public.is_supervisao(_user_id)
      OR public.is_instrutor(_user_id)
$$;

GRANT EXECUTE ON FUNCTION public.is_instrutor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_pitocador(uuid, uuid) TO authenticated;

-- ---------- Pitocador ----------
CREATE TABLE IF NOT EXISTS public.pitocador_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  op_date date NOT NULL DEFAULT CURRENT_DATE,
  missao text NOT NULL DEFAULT '',
  instrutor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  instrutor_tag text NOT NULL DEFAULT '',
  aeronave text NOT NULL DEFAULT '',
  minutes integer NOT NULL DEFAULT 0,
  grau integer,
  observacao text NOT NULL DEFAULT '',
  flight_id uuid REFERENCES public.annotator_flights(id) ON DELETE SET NULL,
  created_by uuid,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pitocador_grau_range CHECK (grau IS NULL OR (grau >= 1 AND grau <= 6))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pitocador_entries TO authenticated;
GRANT ALL ON public.pitocador_entries TO service_role;
ALTER TABLE public.pitocador_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pitocador_select" ON public.pitocador_entries;
CREATE POLICY "pitocador_select" ON public.pitocador_entries FOR SELECT TO authenticated
  USING (public.can_view_pitocador(auth.uid(), profile_id));
DROP POLICY IF EXISTS "pitocador_insert" ON public.pitocador_entries;
CREATE POLICY "pitocador_insert" ON public.pitocador_entries FOR INSERT TO authenticated
  WITH CHECK (public.can_view_pitocador(auth.uid(), profile_id));
DROP POLICY IF EXISTS "pitocador_update" ON public.pitocador_entries;
CREATE POLICY "pitocador_update" ON public.pitocador_entries FOR UPDATE TO authenticated
  USING (public.can_view_pitocador(auth.uid(), profile_id))
  WITH CHECK (public.can_view_pitocador(auth.uid(), profile_id));
DROP POLICY IF EXISTS "pitocador_delete" ON public.pitocador_entries;
CREATE POLICY "pitocador_delete" ON public.pitocador_entries FOR DELETE TO authenticated
  USING (public.can_view_pitocador(auth.uid(), profile_id));

DROP TRIGGER IF EXISTS pitocador_entries_updated ON public.pitocador_entries;
CREATE TRIGGER pitocador_entries_updated BEFORE UPDATE ON public.pitocador_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS pitocador_entries_profile_idx ON public.pitocador_entries (profile_id, op_date DESC);

-- ---------- Comercial: categorias ----------
CREATE TABLE IF NOT EXISTS public.commerce_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  parent_id uuid REFERENCES public.commerce_categories(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commerce_categories TO authenticated;
GRANT ALL ON public.commerce_categories TO service_role;
ALTER TABLE public.commerce_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commerce_categories_select" ON public.commerce_categories;
CREATE POLICY "commerce_categories_select" ON public.commerce_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "commerce_categories_write" ON public.commerce_categories;
CREATE POLICY "commerce_categories_write" ON public.commerce_categories FOR ALL TO authenticated
  USING (public.can_manage_ops(auth.uid())) WITH CHECK (public.can_manage_ops(auth.uid()));
DROP TRIGGER IF EXISTS commerce_categories_updated ON public.commerce_categories;
CREATE TRIGGER commerce_categories_updated BEFORE UPDATE ON public.commerce_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Comercial: produtos ----------
CREATE TABLE IF NOT EXISTS public.commerce_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  category_id uuid REFERENCES public.commerce_categories(id) ON DELETE SET NULL,
  subcategory_id uuid REFERENCES public.commerce_categories(id) ON DELETE SET NULL,
  descricao text NOT NULL DEFAULT '',
  preco numeric(10,2) NOT NULL DEFAULT 0,
  photo_path text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  stock_enabled boolean NOT NULL DEFAULT false,
  stock_qty integer NOT NULL DEFAULT 0,
  stock_min integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commerce_products TO authenticated;
GRANT ALL ON public.commerce_products TO service_role;
ALTER TABLE public.commerce_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commerce_products_select" ON public.commerce_products;
CREATE POLICY "commerce_products_select" ON public.commerce_products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "commerce_products_write" ON public.commerce_products;
CREATE POLICY "commerce_products_write" ON public.commerce_products FOR ALL TO authenticated
  USING (public.can_manage_ops(auth.uid())) WITH CHECK (public.can_manage_ops(auth.uid()));
DROP TRIGGER IF EXISTS commerce_products_updated ON public.commerce_products;
CREATE TRIGGER commerce_products_updated BEFORE UPDATE ON public.commerce_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Comercial: compras ----------
CREATE TABLE IF NOT EXISTS public.commerce_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  buyer_tag text NOT NULL DEFAULT '',
  purchased_at timestamptz NOT NULL DEFAULT now(),
  total numeric(10,2) NOT NULL DEFAULT 0,
  observacao text NOT NULL DEFAULT '',
  created_by uuid,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commerce_purchases TO authenticated;
GRANT ALL ON public.commerce_purchases TO service_role;
ALTER TABLE public.commerce_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commerce_purchases_select" ON public.commerce_purchases;
CREATE POLICY "commerce_purchases_select" ON public.commerce_purchases FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "commerce_purchases_insert" ON public.commerce_purchases;
CREATE POLICY "commerce_purchases_insert" ON public.commerce_purchases FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS "commerce_purchases_update" ON public.commerce_purchases;
CREATE POLICY "commerce_purchases_update" ON public.commerce_purchases FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.can_manage_ops(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.can_manage_ops(auth.uid()));
DROP POLICY IF EXISTS "commerce_purchases_delete" ON public.commerce_purchases;
CREATE POLICY "commerce_purchases_delete" ON public.commerce_purchases FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.can_manage_ops(auth.uid()));
DROP TRIGGER IF EXISTS commerce_purchases_updated ON public.commerce_purchases;
CREATE TRIGGER commerce_purchases_updated BEFORE UPDATE ON public.commerce_purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.commerce_purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.commerce_purchases(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.commerce_products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  category_name text NOT NULL DEFAULT '',
  subcategory_name text NOT NULL DEFAULT '',
  qty integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commerce_purchase_items TO authenticated;
GRANT ALL ON public.commerce_purchase_items TO service_role;
ALTER TABLE public.commerce_purchase_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commerce_items_select" ON public.commerce_purchase_items;
CREATE POLICY "commerce_items_select" ON public.commerce_purchase_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "commerce_items_write" ON public.commerce_purchase_items;
CREATE POLICY "commerce_items_write" ON public.commerce_purchase_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.commerce_purchases p WHERE p.id = purchase_id
                 AND (p.created_by = auth.uid() OR public.can_manage_ops(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commerce_purchases p WHERE p.id = purchase_id
                 AND (p.created_by = auth.uid() OR public.can_manage_ops(auth.uid()))));

CREATE INDEX IF NOT EXISTS commerce_items_purchase_idx ON public.commerce_purchase_items (purchase_id);

-- ---------- Categorias iniciais do Comercial ----------
INSERT INTO public.commerce_categories (nome, parent_id, sort_order)
SELECT 'Alimentos e Bebidas', NULL, 1
WHERE NOT EXISTS (SELECT 1 FROM public.commerce_categories WHERE nome = 'Alimentos e Bebidas' AND parent_id IS NULL);
INSERT INTO public.commerce_categories (nome, parent_id, sort_order)
SELECT 'Produtos e Vestuário', NULL, 2
WHERE NOT EXISTS (SELECT 1 FROM public.commerce_categories WHERE nome = 'Produtos e Vestuário' AND parent_id IS NULL);

INSERT INTO public.commerce_categories (nome, parent_id, sort_order)
SELECT sub.nome, pai.id, sub.ord
FROM public.commerce_categories pai
JOIN (VALUES ('Refrigerantes',1),('Águas',2),('Energéticos',3),('Chocolates',4),('Salgados',5),('Doces',6)) AS sub(nome, ord) ON true
WHERE pai.nome = 'Alimentos e Bebidas' AND pai.parent_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.commerce_categories c WHERE c.nome = sub.nome AND c.parent_id = pai.id);

INSERT INTO public.commerce_categories (nome, parent_id, sort_order)
SELECT sub.nome, pai.id, sub.ord
FROM public.commerce_categories pai
JOIN (VALUES ('Camisetas',1),('Moletons',2),('Bonés',3),('Patches',4),('Acessórios',5)) AS sub(nome, ord) ON true
WHERE pai.nome = 'Produtos e Vestuário' AND pai.parent_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.commerce_categories c WHERE c.nome = sub.nome AND c.parent_id = pai.id);

-- ---------- Fotos (integrantes e produtos) ----------
DROP POLICY IF EXISTS "fotos_auth_read" ON storage.objects;
CREATE POLICY "fotos_auth_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fotos');
DROP POLICY IF EXISTS "fotos_auth_insert" ON storage.objects;
CREATE POLICY "fotos_auth_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fotos');
DROP POLICY IF EXISTS "fotos_auth_update" ON storage.objects;
CREATE POLICY "fotos_auth_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'fotos') WITH CHECK (bucket_id = 'fotos');
DROP POLICY IF EXISTS "fotos_auth_delete" ON storage.objects;
CREATE POLICY "fotos_auth_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'fotos');
