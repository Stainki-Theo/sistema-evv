import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  ShoppingCart,
  PackagePlus,
  AlertTriangle,
  Pencil,
  Ban,
  RotateCcw,
  ImageOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ComboCreate } from "@/components/ComboCreate";
import {
  useCommerceCategories,
  useCommerceProducts,
  useCommercePurchases,
  useProfiles,
  usePhotoUrl,
  uploadPhoto,
  removePhoto,
} from "@/lib/data";
import { usePermissoes } from "@/lib/permissoes";
import { useAuth, displayName } from "@/lib/auth";
import { personTag, formatDatePtBr } from "@/lib/evv";
import { logChange } from "@/lib/audit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/comercial")({
  head: () => ({
    meta: [
      { title: "Comercial — Produtos e Vendas | EVV" },
      {
        name: "description",
        content:
          "Módulo comercial do EVV: catálogo de alimentos, bebidas e vestuário, controle de estoque e registro de compras dos integrantes.",
      },
      { property: "og:title", content: "Comercial — Produtos e Vendas | EVV" },
      {
        property: "og:description",
        content: "Catálogo, estoque e histórico de compras do esquadrão em uma única tela.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComercialPage,
});

const NONE = "__none__";

function money(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Categoria = { id: string; nome: string; parent_id: string | null; active: boolean };
type Produto = ReturnType<typeof useCommerceProducts>["data"] extends (infer T)[] | undefined
  ? T
  : never;

type CartItem = { productId: string; qty: number };

type Periodo = "hoje" | "semana" | "mes" | "ano" | "custom";

function inicioPeriodo(p: Periodo, de: string, ate: string): { de: string; ate: string } {
  const hoje = new Date();
  const hojeStr = hoje.toISOString().slice(0, 10);
  if (p === "custom") return { de: de || hojeStr, ate: ate || hojeStr };
  if (p === "hoje") return { de: hojeStr, ate: hojeStr };
  if (p === "semana") {
    const d = new Date(hoje);
    d.setDate(d.getDate() - d.getDay());
    return { de: d.toISOString().slice(0, 10), ate: hojeStr };
  }
  if (p === "mes") {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return { de: d.toISOString().slice(0, 10), ate: hojeStr };
  }
  const d = new Date(hoje.getFullYear(), 0, 1);
  return { de: d.toISOString().slice(0, 10), ate: hojeStr };
}

/** Área de foto de produto com proporção preservada (sem cortes/zoom) e ampliação em Dialog. */
function ProductPhoto({
  path,
  alt,
  className,
}: {
  path?: string | null;
  alt: string;
  className?: string;
}) {
  const { data: url } = usePhotoUrl(path);
  const [open, setOpen] = useState(false);

  const box = (
    <span
      className={cn(
        "grid aspect-square w-full place-items-center overflow-hidden rounded border border-border bg-muted",
        url && "cursor-zoom-in",
        className,
      )}
      onClick={() => url && setOpen(true)}
    >
      {url ? (
        <img src={url} alt={alt} loading="lazy" className="h-full w-full object-contain" />
      ) : (
        <ImageOff className="h-6 w-6 text-muted-foreground" />
      )}
    </span>
  );

  if (!url) return box;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {box}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{alt}</DialogTitle>
        </DialogHeader>
        <div className="grid aspect-square w-full place-items-center overflow-hidden rounded bg-muted">
          <img src={url} alt={alt} className="h-full w-full object-contain" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ComercialPage() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { canManageOps } = usePermissoes();
  const { data: categories } = useCommerceCategories();
  const { data: products } = useCommerceProducts();
  const { data: purchases } = useCommercePurchases();
  const { data: profiles } = useProfiles();

  const categoriasAtivas = useMemo(() => (categories ?? []).filter((c) => c.active), [categories]);
  const nomeCategoria = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories ?? []) map.set(c.id, c.nome);
    return map;
  }, [categories]);

  return (
    <>
      <PageHeader title="Comercial" description="Catálogo, compras e relatórios do esquadrão" />

      <Tabs defaultValue="catalogo" className="space-y-4">
        <TabsList>
          <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
          <TabsTrigger value="compras">Compras</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="catalogo">
          <CatalogoTab
            categorias={categories ?? []}
            categoriasAtivas={categoriasAtivas}
            nomeCategoria={nomeCategoria}
            products={products ?? []}
            profiles={profiles ?? []}
            canManageOps={canManageOps}
            profile={profile}
            onChanged={() => {
              qc.invalidateQueries({ queryKey: ["commerce_products"] });
              qc.invalidateQueries({ queryKey: ["commerce_purchases"] });
            }}
          />
        </TabsContent>

        <TabsContent value="compras">
          <ComprasTab
            purchases={purchases ?? []}
            profiles={profiles ?? []}
            canManageOps={canManageOps}
            profile={profile}
            onChanged={() => {
              qc.invalidateQueries({ queryKey: ["commerce_purchases"] });
              qc.invalidateQueries({ queryKey: ["commerce_products"] });
            }}
          />
        </TabsContent>

        <TabsContent value="relatorios">
          <RelatoriosTab purchases={purchases ?? []} profile={profile} />
        </TabsContent>
      </Tabs>
    </>
  );
}

/* ==================== CATÁLOGO ==================== */

function CatalogoTab({
  categorias,
  categoriasAtivas,
  nomeCategoria,
  products,
  profiles,
  canManageOps,
  profile,
  onChanged,
}: {
  categorias: Categoria[];
  categoriasAtivas: Categoria[];
  nomeCategoria: Map<string, string>;
  products: Produto[];
  profiles: NonNullable<ReturnType<typeof useProfiles>["data"]>;
  canManageOps: boolean;
  profile: ReturnType<typeof useAuth>["profile"];
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState(NONE);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [buyer, setBuyer] = useState("");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState<Produto | null>(null);

  const visiveis = useMemo(() => {
    const list = products.filter((p) => p.active);
    if (filtro === NONE) return list;
    return list.filter((p) => p.category_id === filtro);
  }, [products, filtro]);

  const produtoPorId = useMemo(() => {
    const map = new Map<string, Produto>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const total = cart.reduce((soma, item) => {
    const p = produtoPorId.get(item.productId);
    return soma + Number(p?.preco ?? 0) * item.qty;
  }, 0);

  function addToCart(productId: string) {
    setCart((c) => {
      const found = c.find((i) => i.productId === productId);
      if (found) return c.map((i) => (i === found ? { ...i, qty: i.qty + 1 } : i));
      return [...c, { productId, qty: 1 }];
    });
  }

  async function finalizar() {
    if (!cart.length) {
      toast.error("Adicione ao menos um produto.");
      return;
    }
    setSalvando(true);
    const comprador = profiles.find((p) => p.id === buyer);
    const { data: purchase, error } = await supabase
      .from("commerce_purchases")
      .insert({
        buyer_profile_id: buyer || null,
        buyer_tag: comprador ? personTag(comprador) : "Não identificado",
        total,
        observacao: obs.trim(),
        created_by: profile?.id ?? null,
        created_by_name: displayName(profile),
      } as never)
      .select()
      .single();
    if (error || !purchase) {
      setSalvando(false);
      toast.error(error?.message ?? "Falha ao registrar a compra.");
      return;
    }

    // Preço registrado no momento da compra (snapshot): alterações futuras não mudam o histórico.
    const items = cart.map((item) => {
      const p = produtoPorId.get(item.productId)!;
      const unit = Number(p.preco);
      return {
        purchase_id: purchase.id,
        product_id: p.id,
        product_name: p.nome,
        category_name: p.category_id ? (nomeCategoria.get(p.category_id) ?? "") : "",
        subcategory_name: "",
        qty: item.qty,
        unit_price: unit,
        total: unit * item.qty,
      };
    });
    const { error: itemsError } = await supabase
      .from("commerce_purchase_items")
      .insert(items as never);
    if (itemsError) {
      setSalvando(false);
      toast.error(itemsError.message);
      return;
    }

    // Baixa de estoque somente para produtos com controle habilitado.
    for (const item of cart) {
      const p = produtoPorId.get(item.productId)!;
      if (!p.stock_enabled) continue;
      await supabase
        .from("commerce_products")
        .update({ stock_qty: Math.max(0, p.stock_qty - item.qty) } as never)
        .eq("id", p.id);
    }

    await logChange(
      {
        area: "COMERCIAL",
        entity: "commerce_purchases",
        entityId: purchase.id,
        entityLabel: comprador ? personTag(comprador) : "Não identificado",
        action: "INSERT",
        newValue: money(total),
      },
      { id: profile?.id, tag: displayName(profile) },
    );

    setSalvando(false);
    setCart([]);
    setObs("");
    onChanged();
    toast.success(`Compra registrada: ${money(total)}.`);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-4">
        <div className="flex items-center justify-end">
          <Select value={filtro} onValueChange={setFiltro}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Todas as categorias</SelectItem>
              {categoriasAtivas.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visiveis.map((p) => {
            const semEstoque = p.stock_enabled && p.stock_qty <= 0;
            const podeEditar = canManageOps || p.created_by === profile?.id;
            return (
              <Card key={p.id} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col gap-2 p-3">
                  <ProductPhoto path={p.photo_path} alt={p.nome} />
                  <div className="flex min-w-0 items-start justify-between gap-1">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{p.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {(p.category_id ? nomeCategoria.get(p.category_id) : "") || "Sem categoria"}
                      </p>
                    </div>
                    {podeEditar && (
                      <button
                        type="button"
                        aria-label="Editar produto"
                        onClick={() => setEditando(p)}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded hover:bg-muted"
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  {p.descricao && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{p.descricao}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <span className="font-mono text-lg font-bold">{money(Number(p.preco))}</span>
                    {p.stock_enabled && (
                      <StatusBadge tone={semEstoque ? "danger" : "success"}>
                        {semEstoque ? "Esgotado" : `${p.stock_qty} un.`}
                      </StatusBadge>
                    )}
                  </div>
                  <Button size="sm" disabled={semEstoque} onClick={() => addToCart(p.id)}>
                    <ShoppingCart className="mr-1.5 h-4 w-4" /> Adicionar
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {visiveis.length === 0 && (
            <Card className="sm:col-span-2 lg:col-span-3">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nenhum produto cadastrado nesta categoria.
              </CardContent>
            </Card>
          )}
        </div>

        <CategoriasAdmin
          categorias={categorias}
          canManageOps={canManageOps}
          profile={profile}
          onChanged={onChanged}
        />

        <NovoProduto
          categorias={categoriasAtivas}
          onSaved={onChanged}
          onCreateCategoria={async (nome) => {
            await criarCategoria(nome, profile);
            onChanged();
          }}
        />
      </div>

      <Card className="h-fit xl:sticky xl:top-20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
            <ShoppingCart className="h-4 w-4" /> Compra atual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Comprador
            </Label>
            <Select value={buyer} onValueChange={setBuyer}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecionar integrante" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {personTag(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum item adicionado.</p>
          ) : (
            <ul className="space-y-1.5">
              {cart.map((item) => {
                const p = produtoPorId.get(item.productId);
                return (
                  <li
                    key={item.productId}
                    className="flex items-center gap-2 rounded border border-border px-2 py-1.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">{p?.nome}</span>
                    <Input
                      className="h-8 w-14 text-center"
                      value={item.qty}
                      onChange={(e) =>
                        setCart((c) =>
                          c.map((i) =>
                            i.productId === item.productId
                              ? { ...i, qty: Math.max(1, Number(e.target.value) || 1) }
                              : i,
                          ),
                        )
                      }
                    />
                    <span className="w-20 shrink-0 text-right font-mono text-sm">
                      {money(Number(p?.preco ?? 0) * item.qty)}
                    </span>
                    <button
                      type="button"
                      aria-label="Remover item"
                      onClick={() =>
                        setCart((c) => c.filter((i) => i.productId !== item.productId))
                      }
                      className="grid h-8 w-8 shrink-0 place-items-center rounded hover:bg-muted"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-danger" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex items-baseline justify-between border-t border-border pt-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total
            </span>
            <span className="font-mono text-2xl font-bold">{money(total)}</span>
          </div>

          <Textarea
            rows={2}
            placeholder="Observação (forma de pagamento, pendência…)"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
          />
          <Button className="w-full" onClick={finalizar} disabled={salvando}>
            Registrar compra
          </Button>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />O preço é gravado no momento da
            compra: reajustes futuros não alteram o histórico.
          </p>
        </CardContent>
      </Card>

      {editando && (
        <EditarProduto
          produto={editando}
          categorias={categoriasAtivas}
          canManageOps={canManageOps}
          profile={profile}
          onClose={() => setEditando(null)}
          onSaved={() => {
            setEditando(null);
            onChanged();
          }}
          onCreateCategoria={async (nome) => {
            const id = await criarCategoria(nome, profile);
            onChanged();
            return id;
          }}
        />
      )}
    </div>
  );
}

async function criarCategoria(nome: string, profile: ReturnType<typeof useAuth>["profile"]) {
  const label = nome.trim();
  if (!label) throw new Error("Informe o nome da categoria.");
  const { data, error } = await supabase
    .from("commerce_categories")
    .insert({ nome: label } as never)
    .select()
    .single();
  if (error) throw new Error(error.message);
  await logChange(
    {
      area: "COMERCIAL",
      entity: "commerce_categories",
      entityId: data!.id,
      entityLabel: label,
      action: "INSERT",
      newValue: label,
    },
    { id: profile?.id, tag: displayName(profile) },
  );
  return data!.id as string;
}

function CategoriasAdmin({
  categorias,
  canManageOps,
  profile,
  onChanged,
}: {
  categorias: Categoria[];
  canManageOps: boolean;
  profile: ReturnType<typeof useAuth>["profile"];
  onChanged: () => void;
}) {
  const [novo, setNovo] = useState("");
  const [salvando, setSalvando] = useState(false);

  if (!canManageOps) return null;

  async function adicionar() {
    if (!novo.trim()) return;
    setSalvando(true);
    try {
      await criarCategoria(novo, profile);
      setNovo("");
      onChanged();
      toast.success("Categoria criada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar categoria.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtiva(c: Categoria) {
    const { error } = await supabase
      .from("commerce_categories")
      .update({ active: !c.active } as never)
      .eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logChange(
      {
        area: "COMERCIAL",
        entity: "commerce_categories",
        entityId: c.id,
        entityLabel: c.nome,
        action: "UPDATE",
        field: "active",
        fieldLabel: "Ativa",
        oldValue: String(c.active),
        newValue: String(!c.active),
      },
      { id: profile?.id, tag: displayName(profile) },
    );
    onChanged();
  }

  async function renomear(c: Categoria) {
    const nome = window.prompt("Novo nome da categoria", c.nome);
    if (!nome || !nome.trim() || nome.trim() === c.nome) return;
    const { error } = await supabase
      .from("commerce_categories")
      .update({ nome: nome.trim() } as never)
      .eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logChange(
      {
        area: "COMERCIAL",
        entity: "commerce_categories",
        entityId: c.id,
        entityLabel: nome.trim(),
        action: "UPDATE",
        field: "nome",
        fieldLabel: "Nome",
        oldValue: c.nome,
        newValue: nome.trim(),
      },
      { id: profile?.id, tag: displayName(profile) },
    );
    onChanged();
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
          Categorias
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {categorias.map((c) => (
            <span
              key={c.id}
              className={cn(
                "flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs",
                !c.active && "opacity-50",
              )}
            >
              <button type="button" onClick={() => renomear(c)} className="font-medium">
                {c.nome}
              </button>
              <button
                type="button"
                aria-label={c.active ? "Desativar categoria" : "Reativar categoria"}
                onClick={() => alternarAtiva(c)}
                className="text-muted-foreground hover:text-foreground"
              >
                {c.active ? <Ban className="h-3 w-3" /> : <RotateCcw className="h-3 w-3" />}
              </button>
            </span>
          ))}
          {categorias.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Nova categoria"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
          />
          <Button onClick={adicionar} disabled={salvando}>
            <Plus className="mr-1.5 h-4 w-4" /> Adicionar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NovoProduto({
  categorias,
  onSaved,
  onCreateCategoria,
}: {
  categorias: Categoria[];
  onSaved: () => void;
  onCreateCategoria: (nome: string) => Promise<void>;
}) {
  const { profile } = useAuth();
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [estoque, setEstoque] = useState(false);
  const [qtd, setQtd] = useState("0");
  const [file, setFile] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim()) {
      toast.error("Informe o nome do produto.");
      return;
    }
    setSalvando(true);
    try {
      const photo = file ? await uploadPhoto("produtos", file) : "";
      const { data, error } = await supabase
        .from("commerce_products")
        .insert({
          nome: nome.trim(),
          preco: Number(preco.replace(",", ".")) || 0,
          category_id: categoria || null,
          descricao: descricao.trim(),
          photo_path: photo,
          stock_enabled: estoque,
          stock_qty: Number(qtd) || 0,
          created_by: profile?.id ?? null,
          created_by_name: displayName(profile),
        } as never)
        .select()
        .single();
      if (error) throw new Error(error.message);
      await logChange(
        {
          area: "COMERCIAL",
          entity: "commerce_products",
          entityId: data!.id,
          entityLabel: nome.trim(),
          action: "INSERT",
          newValue: nome.trim(),
        },
        { id: profile?.id, tag: displayName(profile) },
      );
      setNome("");
      setPreco("");
      setDescricao("");
      setCategoria("");
      setEstoque(false);
      setQtd("0");
      setFile(null);
      onSaved();
      toast.success("Produto cadastrado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao cadastrar o produto.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
          <PackagePlus className="h-4 w-4" /> Novo produto
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Nome</Label>
          <Input className="mt-1" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Preço (R$)
          </Label>
          <Input
            className="mt-1 font-mono"
            placeholder="ex.: 8,00"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Categoria
          </Label>
          <ComboCreate
            className="mt-1"
            value={categoria}
            options={categorias.map((c) => ({ value: c.id, label: c.nome }))}
            placeholder="Selecionar ou criar categoria"
            allowCreate
            onSelect={setCategoria}
            onCreate={async (label) => {
              await onCreateCategoria(label);
            }}
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Descrição
          </Label>
          <Textarea
            className="mt-1"
            rows={2}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={estoque} onCheckedChange={setEstoque} />
            Controlar estoque
          </label>
          {estoque && (
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Quantidade em estoque
              </Label>
              <Input className="mt-1 w-24" value={qtd} onChange={(e) => setQtd(e.target.value)} />
            </div>
          )}
        </div>
        <div className="sm:col-span-2">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Foto do produto
          </Label>
          <Input
            className="mt-1"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="sm:col-span-2">
          <Button onClick={salvar} disabled={salvando}>
            <Plus className="mr-1.5 h-4 w-4" /> Cadastrar produto
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EditarProduto({
  produto,
  categorias,
  canManageOps,
  profile,
  onClose,
  onSaved,
  onCreateCategoria,
}: {
  produto: Produto;
  categorias: Categoria[];
  canManageOps: boolean;
  profile: ReturnType<typeof useAuth>["profile"];
  onClose: () => void;
  onSaved: () => void;
  onCreateCategoria: (nome: string) => Promise<string>;
}) {
  const [nome, setNome] = useState(produto.nome);
  const [preco, setPreco] = useState(String(produto.preco).replace(".", ","));
  const [categoria, setCategoria] = useState(produto.category_id ?? "");
  const [descricao, setDescricao] = useState(produto.descricao ?? "");
  const [estoque, setEstoque] = useState(produto.stock_enabled);
  const [qtd, setQtd] = useState(String(produto.stock_qty ?? 0));
  const [ativo, setAtivo] = useState(produto.active);
  const [file, setFile] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

  const actor = { id: profile?.id, tag: displayName(profile) };

  async function registrar(
    field: string,
    fieldLabel: string,
    oldValue: unknown,
    newValue: unknown,
  ) {
    if (String(oldValue) === String(newValue)) return;
    await logChange(
      {
        area: "COMERCIAL",
        entity: "commerce_products",
        entityId: produto.id,
        entityLabel: nome.trim() || produto.nome,
        action: "UPDATE",
        field,
        fieldLabel,
        oldValue: oldValue as never,
        newValue: newValue as never,
      },
      actor,
    );
  }

  async function salvar() {
    if (!nome.trim()) {
      toast.error("Informe o nome do produto.");
      return;
    }
    setSalvando(true);
    try {
      let photo = produto.photo_path;
      if (file) {
        await removePhoto(produto.photo_path);
        photo = await uploadPhoto("produtos", file);
      }
      const precoNum = Number(preco.replace(",", ".")) || 0;
      const update = {
        nome: nome.trim(),
        preco: precoNum,
        category_id: categoria || null,
        descricao: descricao.trim(),
        photo_path: photo,
        stock_enabled: estoque,
        stock_qty: Number(qtd) || 0,
        active: ativo,
      };
      const { error } = await supabase
        .from("commerce_products")
        .update(update as never)
        .eq("id", produto.id);
      if (error) throw new Error(error.message);

      await registrar("nome", "Nome", produto.nome, update.nome);
      await registrar("preco", "Preço", produto.preco, update.preco);
      await registrar(
        "category_id",
        "Categoria",
        categorias.find((c) => c.id === produto.category_id)?.nome ?? "",
        categorias.find((c) => c.id === update.category_id)?.nome ?? "",
      );
      await registrar("stock_qty", "Quantidade em estoque", produto.stock_qty, update.stock_qty);
      await registrar("active", "Ativo", produto.active, update.active);

      onSaved();
      toast.success("Produto atualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar o produto.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    setSalvando(true);
    try {
      await removePhoto(produto.photo_path);
      const { error } = await supabase.from("commerce_products").delete().eq("id", produto.id);
      if (error) throw new Error(error.message);
      await logChange(
        {
          area: "COMERCIAL",
          entity: "commerce_products",
          entityId: produto.id,
          entityLabel: produto.nome,
          action: "DELETE",
          oldValue: produto.nome,
        },
        actor,
      );
      onSaved();
      toast.success("Produto excluído.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir o produto.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" /> Editar produto
          </DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <ProductPhoto path={produto.photo_path} alt={produto.nome} className="max-w-40" />
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Nome
            </Label>
            <Input className="mt-1" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Preço (R$)
            </Label>
            <Input
              className="mt-1 font-mono"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Categoria
            </Label>
            <ComboCreate
              className="mt-1"
              value={categoria}
              options={categorias.map((c) => ({ value: c.id, label: c.nome }))}
              placeholder="Selecionar ou criar categoria"
              allowCreate
              onSelect={setCategoria}
              onCreate={async (label) => {
                const id = await onCreateCategoria(label);
                setCategoria(id);
              }}
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Descrição
            </Label>
            <Textarea
              className="mt-1"
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={estoque} onCheckedChange={setEstoque} />
              Controlar estoque
            </label>
            {estoque && (
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Quantidade em estoque
                </Label>
                <Input className="mt-1 w-24" value={qtd} onChange={(e) => setQtd(e.target.value)} />
              </div>
            )}
            <label className="ml-auto flex items-center gap-2 text-sm">
              <Switch checked={ativo} onCheckedChange={setAtivo} />
              Disponível
            </label>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Trocar foto
            </Label>
            <Input
              className="mt-1"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            {canManageOps ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" disabled={salvando}>
                    <Trash2 className="mr-1.5 h-4 w-4 text-danger" /> Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir produto</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação remove “{produto.nome}” e sua foto definitivamente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={excluir}>Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <span />
            )}
            <Button onClick={salvar} disabled={salvando}>
              Salvar alterações
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ==================== COMPRAS ==================== */

type Purchase = NonNullable<ReturnType<typeof useCommercePurchases>["data"]>[number];

function ComprasTab({
  purchases,
  profiles,
  canManageOps,
  profile,
  onChanged,
}: {
  purchases: NonNullable<ReturnType<typeof useCommercePurchases>["data"]>;
  profiles: ReturnType<typeof useProfiles>["data"];
  canManageOps: boolean;
  profile: ReturnType<typeof useAuth>["profile"];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [deleting, setDeleting] = useState<Purchase | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  /** ADMIN, Presidente, Supervisão e Diretores corrigem qualquer lançamento;
   *  quem criou continua podendo corrigir o próprio. */
  const podeEditar = (c: Purchase) => canManageOps || c.created_by === profile?.id;

  async function excluirCompra() {
    if (!deleting) return;
    setDeletingBusy(true);
    const quantidades = new Map<string, number>();
    for (const item of deleting.commerce_purchase_items ?? []) {
      if (!item.product_id) continue;
      quantidades.set(item.product_id, (quantidades.get(item.product_id) ?? 0) + Number(item.qty));
    }

    const estoquesAlterados: Array<{ id: string; stock_qty: number }> = [];
    try {
      if (quantidades.size) {
        const { data: produtos, error: produtosError } = await supabase
          .from("commerce_products")
          .select("id, stock_enabled, stock_qty")
          .in("id", [...quantidades.keys()]);
        if (produtosError) throw produtosError;

        for (const produto of produtos ?? []) {
          if (!produto.stock_enabled) continue;
          const anterior = Number(produto.stock_qty) || 0;
          const { error: estoqueError } = await supabase
            .from("commerce_products")
            .update({ stock_qty: anterior + (quantidades.get(produto.id) ?? 0) } as never)
            .eq("id", produto.id);
          if (estoqueError) throw estoqueError;
          estoquesAlterados.push({ id: produto.id, stock_qty: anterior });
        }
      }

      const { error } = await supabase.from("commerce_purchases").delete().eq("id", deleting.id);
      if (error) throw error;

      await logChange(
        {
          area: "COMERCIAL",
          entity: "commerce_purchases",
          entityId: deleting.id,
          entityLabel: `Venda ${deleting.buyer_tag || "sem comprador"}`,
          action: "DELETE",
          oldValue: `${money(Number(deleting.total))} · ${(deleting.commerce_purchase_items ?? []).length} item(ns)`,
        },
        { id: profile?.id, tag: displayName(profile) },
      );

      setDeleting(null);
      onChanged();
      toast.success("Lançamento apagado e estoque atualizado.");
    } catch (e) {
      for (const estoque of estoquesAlterados.reverse()) {
        await supabase
          .from("commerce_products")
          .update({ stock_qty: estoque.stock_qty } as never)
          .eq("id", estoque.id);
      }
      toast.error(e instanceof Error ? e.message : "Falha ao apagar o lançamento.");
    } finally {
      setDeletingBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
          Histórico de compras
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {purchases.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma compra registrada.</p>
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-2">Comprador</th>
                <th className="py-2 pr-2">Produto(s)</th>
                <th className="py-2 pr-2 text-right">Qtd.</th>
                <th className="py-2 pr-2 text-right">Preço unit.</th>
                <th className="py-2 pr-2 text-right">Total</th>
                <th className="py-2 pl-2">Data</th>
                <th className="py-2 pl-2" />
              </tr>
            </thead>
            <tbody>
              {purchases.map((c) => {
                const itens = c.commerce_purchase_items ?? [];
                const acao =
                  podeEditar(c) || canManageOps ? (
                    <div className="flex items-center gap-1">
                      {podeEditar(c) && (
                        <button
                          type="button"
                          aria-label="Editar lançamento"
                          title="Editar lançamento"
                          onClick={() => setEditing(c)}
                          className="grid h-8 w-8 place-items-center rounded hover:bg-muted"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canManageOps && (
                        <button
                          type="button"
                          aria-label="Apagar lançamento"
                          title="Apagar lançamento"
                          onClick={() => setDeleting(c)}
                          className="grid h-8 w-8 place-items-center rounded hover:bg-muted"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-danger" />
                        </button>
                      )}
                    </div>
                  ) : null;
                if (itens.length === 0) {
                  return (
                    <tr key={c.id} className="border-b border-border/60">
                      <td className="py-2 pr-2 font-medium">{c.buyer_tag || "Não identificado"}</td>
                      <td className="py-2 pr-2 text-muted-foreground" colSpan={3}>
                        —
                      </td>
                      <td className="py-2 pr-2 text-right font-mono">{money(Number(c.total))}</td>
                      <td className="py-2 pl-2 text-xs text-muted-foreground">
                        {formatDatePtBr(String(c.purchased_at).slice(0, 10))}
                      </td>
                      <td className="py-2 pl-2">{acao}</td>
                    </tr>
                  );
                }
                return itens.map((i, idx) => (
                  <tr key={i.id} className="border-b border-border/60">
                    <td className="py-2 pr-2 font-medium">
                      {idx === 0 ? c.buyer_tag || "Não identificado" : ""}
                    </td>
                    <td className="py-2 pr-2">{i.product_name}</td>
                    <td className="py-2 pr-2 text-right">{i.qty}</td>
                    <td className="py-2 pr-2 text-right font-mono">
                      {money(Number(i.unit_price))}
                    </td>
                    <td className="py-2 pr-2 text-right font-mono">{money(Number(i.total))}</td>
                    <td className="py-2 pl-2 text-xs text-muted-foreground">
                      {idx === 0 ? formatDatePtBr(String(c.purchased_at).slice(0, 10)) : ""}
                    </td>
                    <td className="py-2 pl-2">{idx === 0 ? acao : null}</td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        )}
      </CardContent>

      {editing && (
        <EditarVendaDialog
          purchase={editing}
          profiles={profiles ?? []}
          profile={profile}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar lançamento do histórico?</AlertDialogTitle>
            <AlertDialogDescription>
              A compra será removida definitivamente. Os itens com controle de estoque serão
              devolvidos ao estoque automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluirCompra} disabled={deletingBusy}>
              {deletingBusy ? "Apagando…" : "Apagar lançamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/** Correção auditada de um lançamento já existente no histórico de vendas. */
function EditarVendaDialog({
  purchase,
  profiles,
  profile,
  onClose,
  onSaved,
}: {
  purchase: Purchase;
  profiles: NonNullable<ReturnType<typeof useProfiles>["data"]>;
  profile: ReturnType<typeof useAuth>["profile"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const iso = String(purchase.purchased_at);
  const local = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const [buyerId, setBuyerId] = useState(purchase.buyer_profile_id ?? NONE);
  const [buyerTag, setBuyerTag] = useState(purchase.buyer_tag ?? "");
  const [data, setData] = useState(
    `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`,
  );
  const [hora, setHora] = useState(`${pad(local.getHours())}:${pad(local.getMinutes())}`);
  const [observacao, setObservacao] = useState(purchase.observacao ?? "");
  const [itens, setItens] = useState(
    (purchase.commerce_purchase_items ?? []).map((i) => ({
      id: i.id,
      product_name: i.product_name ?? "",
      category_name: i.category_name ?? "",
      qty: Number(i.qty) || 0,
      unit_price: Number(i.unit_price) || 0,
    })),
  );
  const [saving, setSaving] = useState(false);

  const total = itens.reduce((s, i) => s + i.qty * i.unit_price, 0);

  function patchItem(id: string, patch: Partial<(typeof itens)[number]>) {
    setItens((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  const actor = { id: profile?.id, tag: displayName(profile) };

  async function salvar() {
    setSaving(true);
    try {
      const tagEscolhida =
        buyerId === NONE
          ? buyerTag.trim()
          : personTag(profiles.find((p) => p.id === buyerId) as never) || buyerTag.trim();
      const purchasedAt = new Date(`${data}T${hora || "00:00"}`).toISOString();

      const cabecalho = {
        buyer_profile_id: buyerId === NONE ? null : buyerId,
        buyer_tag: tagEscolhida,
        purchased_at: purchasedAt,
        observacao,
        total,
      };
      const { error } = await supabase
        .from("commerce_purchases")
        .update(cabecalho as never)
        .eq("id", purchase.id);
      if (error) throw error;

      const campos: { key: keyof typeof cabecalho; label: string; antes: unknown }[] = [
        { key: "buyer_tag", label: "Comprador", antes: purchase.buyer_tag },
        { key: "purchased_at", label: "Data/horário", antes: purchase.purchased_at },
        { key: "observacao", label: "Observação", antes: purchase.observacao },
        { key: "total", label: "Total", antes: purchase.total },
      ];
      for (const campo of campos) {
        const novo = cabecalho[campo.key];
        if (String(campo.antes ?? "") !== String(novo ?? "")) {
          await logChange(
            {
              area: "COMERCIAL",
              entity: "commerce_purchases",
              entityId: purchase.id,
              entityLabel: `Venda ${tagEscolhida || "sem comprador"}`,
              action: "UPDATE",
              field: String(campo.key),
              fieldLabel: campo.label,
              oldValue: String(campo.antes ?? "") || "(vazio)",
              newValue: String(novo ?? "") || "(vazio)",
            },
            actor,
          );
        }
      }

      for (const item of itens) {
        const antes = (purchase.commerce_purchase_items ?? []).find((i) => i.id === item.id);
        const payload = {
          product_name: item.product_name,
          category_name: item.category_name,
          qty: item.qty,
          unit_price: item.unit_price,
          total: item.qty * item.unit_price,
        };
        const { error: itemError } = await supabase
          .from("commerce_purchase_items")
          .update(payload as never)
          .eq("id", item.id);
        if (itemError) throw itemError;

        const camposItem: { key: keyof typeof payload; label: string }[] = [
          { key: "product_name", label: "Produto" },
          { key: "category_name", label: "Categoria" },
          { key: "qty", label: "Quantidade" },
          { key: "unit_price", label: "Preço unitário" },
          { key: "total", label: "Total do item" },
        ];
        for (const campo of camposItem) {
          const antigo = (antes as Record<string, unknown> | undefined)?.[campo.key];
          const novo = payload[campo.key];
          if (String(antigo ?? "") !== String(novo ?? "")) {
            await logChange(
              {
                area: "COMERCIAL",
                entity: "commerce_purchase_items",
                entityId: item.id,
                entityLabel: `${tagEscolhida || "Venda"} · ${item.product_name}`,
                action: "UPDATE",
                field: String(campo.key),
                fieldLabel: campo.label,
                oldValue: String(antigo ?? "") || "(vazio)",
                newValue: String(novo ?? "") || "(vazio)",
              },
              actor,
            );
          }
        }
      }

      toast.success("Lançamento corrigido e registrado no log de alterações.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar o lançamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar lançamento do histórico</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Comprador
              </Label>
              <Select
                value={buyerId}
                onValueChange={(v) => {
                  setBuyerId(v);
                  const p = profiles.find((x) => x.id === v);
                  if (p) setBuyerTag(personTag(p as never));
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecionar integrante" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Não identificado</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {personTag(p as never)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Identificação registrada
              </Label>
              <Input
                className="mt-1"
                value={buyerTag}
                onChange={(e) => setBuyerTag(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Data
              </Label>
              <Input
                type="date"
                className="mt-1"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Horário
              </Label>
              <Input
                type="time"
                className="mt-1"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            {itens.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Este lançamento não possui itens detalhados.
              </p>
            )}
            {itens.map((i) => (
              <div
                key={i.id}
                className="grid gap-2 rounded border border-border p-2 sm:grid-cols-[1fr_1fr_5rem_7rem]"
              >
                <div>
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Produto
                  </Label>
                  <Input
                    className="mt-1"
                    value={i.product_name}
                    onChange={(e) => patchItem(i.id, { product_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Categoria
                  </Label>
                  <Input
                    className="mt-1"
                    value={i.category_name}
                    onChange={(e) => patchItem(i.id, { category_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Qtd.
                  </Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={0}
                    value={i.qty}
                    onChange={(e) => patchItem(i.id, { qty: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Preço unit.
                  </Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={0}
                    step="0.01"
                    value={i.unit_price}
                    onChange={(e) => patchItem(i.id, { unit_price: Number(e.target.value) || 0 })}
                  />
                </div>
                <p className="text-xs text-muted-foreground sm:col-span-4">
                  Total do item: <span className="font-mono">{money(i.qty * i.unit_price)}</span>
                </p>
              </div>
            ))}
          </div>

          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Observação
            </Label>
            <Textarea
              className="mt-1"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <span className="text-sm">
              Total recalculado: <span className="font-mono font-bold">{money(total)}</span>
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={salvar} disabled={saving}>
                {saving ? "Salvando…" : "Salvar correção"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Toda correção fica registrada no Log de Alterações com autor, data/hora, valor anterior
            e novo.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ==================== RELATÓRIOS ==================== */

function PeriodoSeletor({
  periodo,
  setPeriodo,
  de,
  setDe,
  ate,
  setAte,
}: {
  periodo: Periodo;
  setPeriodo: (p: Periodo) => void;
  de: string;
  setDe: (v: string) => void;
  ate: string;
  setAte: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="hoje">Hoje</SelectItem>
          <SelectItem value="semana">Esta semana</SelectItem>
          <SelectItem value="mes">Este mês</SelectItem>
          <SelectItem value="ano">Este ano</SelectItem>
          <SelectItem value="custom">Período personalizado</SelectItem>
        </SelectContent>
      </Select>
      {periodo === "custom" && (
        <>
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">De</Label>
            <Input
              type="date"
              className="mt-1"
              value={de}
              onChange={(e) => setDe(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Até
            </Label>
            <Input
              type="date"
              className="mt-1"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
            />
          </div>
        </>
      )}
    </div>
  );
}

function RelatoriosTab({
  purchases,
  profile,
}: {
  purchases: NonNullable<ReturnType<typeof useCommercePurchases>["data"]>;
  profile: ReturnType<typeof useAuth>["profile"];
}) {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const [periodoMinhas, setPeriodoMinhas] = useState<Periodo>("mes");
  const [deMinhas, setDeMinhas] = useState("");
  const [ateMinhas, setAteMinhas] = useState("");

  const { de: deFinal, ate: ateFinal } = inicioPeriodo(periodo, de, ate);
  const { de: deMinhasFinal, ate: ateMinhasFinal } = inicioPeriodo(
    periodoMinhas,
    deMinhas,
    ateMinhas,
  );

  const noPeriodo = useMemo(
    () =>
      purchases.filter((c) => {
        const d = String(c.purchased_at).slice(0, 10);
        return d >= deFinal && d <= ateFinal;
      }),
    [purchases, deFinal, ateFinal],
  );

  const porPessoa = useMemo(() => {
    const map = new Map<string, { tag: string; compras: number; total: number }>();
    for (const c of noPeriodo) {
      const chave = c.buyer_tag || "Não identificado";
      const atual = map.get(chave) ?? { tag: chave, compras: 0, total: 0 };
      atual.compras += 1;
      atual.total += Number(c.total);
      map.set(chave, atual);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [noPeriodo]);

  const porCategoria = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; total: number }>();
    for (const c of noPeriodo) {
      for (const i of c.commerce_purchase_items ?? []) {
        const chave = i.category_name || "Sem categoria";
        const atual = map.get(chave) ?? { nome: chave, qtd: 0, total: 0 };
        atual.qtd += i.qty;
        atual.total += Number(i.total);
        map.set(chave, atual);
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [noPeriodo]);

  const minhasCompras = useMemo(
    () =>
      purchases.filter((c) => {
        if (c.buyer_profile_id !== profile?.id) return false;
        const d = String(c.purchased_at).slice(0, 10);
        return d >= deMinhasFinal && d <= ateMinhasFinal;
      }),
    [purchases, profile?.id, deMinhasFinal, ateMinhasFinal],
  );
  const totalMinhas = minhasCompras.reduce((s, c) => s + Number(c.total), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
            Gasto total por pessoa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <PeriodoSeletor
            periodo={periodo}
            setPeriodo={setPeriodo}
            de={de}
            setDe={setDe}
            ate={ate}
            setAte={setAte}
          />
          {porPessoa.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma compra no período.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-2">Nome / Trigrama</th>
                  <th className="py-2 pr-2 text-right">Compras</th>
                  <th className="py-2 pr-2 text-right">Total gasto</th>
                </tr>
              </thead>
              <tbody>
                {porPessoa.map((p) => (
                  <tr key={p.tag} className="border-b border-border/60">
                    <td className="py-2 pr-2 font-medium">{p.tag}</td>
                    <td className="py-2 pr-2 text-right">{p.compras}</td>
                    <td className="py-2 pr-2 text-right font-mono">{money(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
            Resumo por categoria no período
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <PeriodoSeletor
            periodo={periodo}
            setPeriodo={setPeriodo}
            de={de}
            setDe={setDe}
            ate={ate}
            setAte={setAte}
          />
          {porCategoria.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma venda no período.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-2">Categoria</th>
                  <th className="py-2 pr-2 text-right">Quantidade</th>
                  <th className="py-2 pr-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {porCategoria.map((c) => (
                  <tr key={c.nome} className="border-b border-border/60">
                    <td className="py-2 pr-2 font-medium">{c.nome}</td>
                    <td className="py-2 pr-2 text-right">{c.qtd}</td>
                    <td className="py-2 pr-2 text-right font-mono">{money(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
            Minhas compras
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <PeriodoSeletor
            periodo={periodoMinhas}
            setPeriodo={setPeriodoMinhas}
            de={deMinhas}
            setDe={setDeMinhas}
            ate={ateMinhas}
            setAte={setAteMinhas}
          />
          <div className="flex items-baseline justify-between border-b border-border pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total gasto no período
            </span>
            <span className="font-mono text-xl font-bold">{money(totalMinhas)}</span>
          </div>
          {minhasCompras.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma compra no período.</p>
          ) : (
            <ul className="space-y-1.5">
              {minhasCompras.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {formatDatePtBr(String(c.purchased_at).slice(0, 10))}
                  </span>
                  <span className="font-mono">{money(Number(c.total))}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
