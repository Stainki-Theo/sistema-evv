import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ImagePlus, Package, PackagePlus, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { PhotoThumb } from "@/components/PhotoAvatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { uploadPhoto } from "@/lib/data";
import { usePermissoes } from "@/lib/permissoes";

const MATERIAL_KEY = "material_carga:inventario";

type Exemplar = { id: string; identificacao: string; estado: string; foto_path: string; caracteristicas: string; cuidados: string; observacao: string };
type MaterialItem = {
  id: string; nome: string; categoria: string; quantidade: number; unidade: string; localizacao: string; estado: string;
  observacao: string; foto_path: string; caracteristicas: string; cuidados: string; exemplares: Exemplar[]; updated_at: string;
};

const uid = (prefix: string) => globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const emptyExemplar = (): Exemplar => ({ id: uid("exemplar"), identificacao: "", estado: "Disponível", foto_path: "", caracteristicas: "", cuidados: "", observacao: "" });
const normalize = (raw: Partial<MaterialItem>): MaterialItem => ({
  id: raw.id || uid("material"), nome: raw.nome ?? "", categoria: raw.categoria ?? "", quantidade: Math.max(0, Number(raw.quantidade) || 0), unidade: raw.unidade || "un",
  localizacao: raw.localizacao ?? "", estado: raw.estado || "Disponível", observacao: raw.observacao ?? "", foto_path: raw.foto_path ?? "", caracteristicas: raw.caracteristicas ?? "", cuidados: raw.cuidados ?? "",
  exemplares: Array.isArray(raw.exemplares) ? raw.exemplares.map((e) => ({ ...emptyExemplar(), ...e })) : [], updated_at: raw.updated_at || new Date().toISOString(),
});
const emptyItem = () => normalize({});

async function listMaterialItems(): Promise<MaterialItem[]> {
  const { data, error } = await supabase.from("app_settings").select("value").eq("key", MATERIAL_KEY).maybeSingle();
  if (error) throw error;
  if (!data?.value) return [];
  try { const parsed = JSON.parse(data.value); return Array.isArray(parsed) ? parsed.map(normalize) : []; } catch { return []; }
}
async function persist(items: MaterialItem[]) {
  const normalized = items.map((item) => normalize({ ...item, nome: item.nome.trim(), updated_at: new Date().toISOString() }));
  const { error } = await supabase.from("app_settings").upsert({ key: MATERIAL_KEY, value: JSON.stringify(normalized) }, { onConflict: "key" });
  if (error) throw error;
  return normalized;
}

export const Route = createFileRoute("/_authenticated/material-carga")({ component: MaterialCargaPage, head: () => ({ meta: [{ title: "Material Carga — EVV" }] }) });

function MaterialCargaPage() {
  const { canManageOps } = usePermissoes();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["material-carga"], queryFn: listMaterialItems, enabled: canManageOps });
  const [items, setItems] = useState<MaterialItem[]>([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => setItems(data ?? []), [data]);
  const editing = items.find((item) => item.id === editingId) ?? null;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter((item) => [item.nome, item.categoria, item.localizacao, item.estado].join(" ").toLowerCase().includes(q)) : items;
  }, [items, search]);
  if (!canManageOps) return <Navigate to="/home" replace />;

  const change = (id: string, patch: Partial<MaterialItem>) => setItems((all) => all.map((item) => item.id === id ? { ...item, ...patch } : item));
  const changeExemplar = (materialId: string, exemplarId: string, patch: Partial<Exemplar>) => setItems((all) => all.map((item) => item.id === materialId ? { ...item, exemplares: item.exemplares.map((e) => e.id === exemplarId ? { ...e, ...patch } : e) } : item));
  async function upload(materialId: string, exemplarId: string | null, file?: File) {
    if (!file) return;
    try {
      const path = await uploadPhoto(`materiais/${materialId}${exemplarId ? `/exemplares/${exemplarId}` : ""}`, file);
      if (exemplarId) changeExemplar(materialId, exemplarId, { foto_path: path }); else change(materialId, { foto_path: path });
      toast.success("Foto adicionada. Salve as alterações para concluir.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível enviar a foto."); }
  }
  async function save() {
    if (items.some((item) => !item.nome.trim())) return toast.error("Preencha o nome de todos os materiais.");
    setSaving(true);
    try { const saved = await persist(items); setItems(saved); await qc.invalidateQueries({ queryKey: ["material-carga"] }); toast.success("Material Carga atualizado."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  }

  return <>
    <PageHeader title="Material Carga" description="Inventário visual e controle individual dos materiais" actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { const item = emptyItem(); setItems((all) => [...all, item]); setEditingId(item.id); }}><PackagePlus className="mr-2 h-4 w-4" />Adicionar material</Button><Button onClick={() => void save()} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Salvando…" : "Salvar alterações"}</Button></div>} />
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="relative w-full max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar material, categoria ou local" value={search} onChange={(e) => setSearch(e.target.value)} /></div><span className="rounded-full border bg-card px-4 py-2 text-sm"><strong className="font-mono text-aviation">{items.length}</strong> materiais</span></div>
    {isLoading ? <p className="text-sm text-muted-foreground">Carregando inventário…</p> : filtered.length === 0 ? <Card><CardContent className="grid place-items-center gap-3 py-16 text-center text-muted-foreground"><Package className="h-10 w-10" /><p>Nenhum material cadastrado.</p></CardContent></Card> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><PhotoThumb path={item.foto_path} alt={item.nome || "Material"} className="h-44 rounded-none border-0" /><div className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">{item.categoria || "Sem categoria"}</p><h2 className="mt-1 text-lg font-bold">{item.nome || "Novo material"}</h2></div><span className="rounded-full bg-aviation/10 px-3 py-1 font-mono text-sm font-bold text-aviation">{item.quantidade} {item.unidade}</span></div><div className="mt-4 grid grid-cols-2 gap-2 text-sm"><Info label="Estado" value={item.estado} /><Info label="Localização" value={item.localizacao || "—"} /></div><p className="mt-3 text-sm text-muted-foreground">{item.exemplares.length ? `${item.exemplares.length} exemplares identificados` : "Sem exemplares individuais"}</p><Button className="mt-4 w-full" variant="outline" onClick={() => setEditingId(item.id)}>Expandir ficha <ChevronRight className="ml-2 h-4 w-4" /></Button></div></article>)}</div>}
    <Dialog open={!!editing} onOpenChange={(open) => !open && setEditingId(null)}>{editing && <MaterialDialog item={editing} change={(patch) => change(editing.id, patch)} changeExemplar={(id, patch) => changeExemplar(editing.id, id, patch)} upload={(exemplarId, file) => upload(editing.id, exemplarId, file)} remove={() => { setItems((all) => all.filter((i) => i.id !== editing.id)); setEditingId(null); }} close={() => setEditingId(null)} />}</Dialog>
  </>;
}

function MaterialDialog({ item, change, changeExemplar, upload, remove, close }: { item: MaterialItem; change: (patch: Partial<MaterialItem>) => void; changeExemplar: (id: string, patch: Partial<Exemplar>) => void; upload: (id: string | null, file?: File) => void; remove: () => void; close: () => void }) {
  return <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{item.nome || "Novo material"}</DialogTitle></DialogHeader><div className="grid gap-5 md:grid-cols-[15rem_1fr]"><div><PhotoThumb path={item.foto_path} alt={item.nome || "Material"} className="h-48 rounded-xl" /><Label className="mt-3 flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm hover:bg-muted"><ImagePlus className="mr-2 h-4 w-4" />Escolher foto<Input className="hidden" type="file" accept="image/*" onChange={(e) => void upload(null, e.target.files?.[0])} /></Label></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Material" value={item.nome} onChange={(nome) => change({ nome })} /><Field label="Categoria" value={item.categoria} onChange={(categoria) => change({ categoria })} /><Field label="Quantidade" value={String(item.quantidade)} type="number" onChange={(v) => change({ quantidade: Math.max(0, Number(v) || 0) })} /><Field label="Unidade" value={item.unidade} onChange={(unidade) => change({ unidade })} /><Field label="Localização" value={item.localizacao} onChange={(localizacao) => change({ localizacao })} /><Field label="Estado geral" value={item.estado} onChange={(estado) => change({ estado })} /><Area label="Características gerais" value={item.caracteristicas} onChange={(caracteristicas) => change({ caracteristicas })} /><Area label="Cuidados necessários" value={item.cuidados} onChange={(cuidados) => change({ cuidados })} /><div className="sm:col-span-2"><Area label="Observações" value={item.observacao} onChange={(observacao) => change({ observacao })} /></div></div></div><div className="border-t pt-5"><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-bold">Exemplares individuais</h3><p className="text-sm text-muted-foreground">Cadastre cada unidade separadamente quando precisar acompanhar diferenças entre elas.</p></div><Button variant="outline" onClick={() => change({ exemplares: [...item.exemplares, emptyExemplar()] })}><PackagePlus className="mr-2 h-4 w-4" />Adicionar exemplar</Button></div><div className="space-y-3">{item.exemplares.map((e, index) => <div key={e.id} className="rounded-xl border bg-muted/25 p-4"><div className="mb-3 flex items-center justify-between"><strong>{e.identificacao || `Exemplar ${index + 1}`}</strong><Button size="icon" variant="ghost" className="text-danger" onClick={() => change({ exemplares: item.exemplares.filter((x) => x.id !== e.id) })}><Trash2 className="h-4 w-4" /></Button></div><div className="grid gap-4 md:grid-cols-[9rem_1fr]"><div><PhotoThumb path={e.foto_path} alt={e.identificacao || "Exemplar"} className="h-28" /><Label className="mt-2 flex cursor-pointer items-center justify-center rounded border px-2 py-1.5 text-xs hover:bg-muted"><ImagePlus className="mr-1 h-3.5 w-3.5" />Foto<Input className="hidden" type="file" accept="image/*" onChange={(event) => void upload(e.id, event.target.files?.[0])} /></Label></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Identificação / patrimônio" value={e.identificacao} onChange={(identificacao) => changeExemplar(e.id, { identificacao })} /><Field label="Estado" value={e.estado} onChange={(estado) => changeExemplar(e.id, { estado })} /><Area label="Características" value={e.caracteristicas} onChange={(caracteristicas) => changeExemplar(e.id, { caracteristicas })} /><Area label="Cuidados" value={e.cuidados} onChange={(cuidados) => changeExemplar(e.id, { cuidados })} /><div className="sm:col-span-2"><Area label="Observações" value={e.observacao} onChange={(observacao) => changeExemplar(e.id, { observacao })} /></div></div></div></div>)}</div></div><DialogFooter className="justify-between sm:justify-between"><Button variant="destructive" onClick={remove}><Trash2 className="mr-2 h-4 w-4" />Remover material</Button><Button type="button" onClick={close}>Concluir edição</Button></DialogFooter></DialogContent>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-muted/60 p-2.5"><span className="block text-xs text-muted-foreground">{label}</span><strong className="mt-1 block truncate">{value}</strong></div>; }
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <div><Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label><Input className="mt-1" type={type} min={type === "number" ? 0 : undefined} value={value} onChange={(e) => onChange(e.target.value)} /></div>; }
function Area({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div><Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label><Textarea className="mt-1 min-h-20" value={value} onChange={(e) => onChange(e.target.value)} /></div>; }
