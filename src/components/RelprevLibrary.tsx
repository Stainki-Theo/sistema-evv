import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Loader2, Search, Trash2, Upload, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth, displayName } from "@/lib/auth";
import { useRelprevs, uploadFile, openFile, removeFile } from "@/lib/data";
import { RELPREV_CATEGORIES, todayISO, formatDatePtBr } from "@/lib/evv";

const EMPTY = {
  title: "",
  relprev_date: todayISO(),
  summary: "",
  category: RELPREV_CATEGORIES[0]!,
  keywords: "",
  external_url: "",
};

/** Biblioteca permanente de RELPREVs anteriores, com busca e filtros. */
export function RelprevLibrary() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const { data: relprevs, isLoading } = useRelprevs();
  const [form, setForm] = useState({ ...EMPTY });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("TODAS");
  const [year, setYear] = useState("TODOS");
  const fileRef = useRef<HTMLInputElement>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["relprevs"] });

  const years = useMemo(
    () => [...new Set((relprevs ?? []).map((r) => r.relprev_date.slice(0, 4)))].sort().reverse(),
    [relprevs],
  );

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (relprevs ?? []).filter((r) => {
      if (category !== "TODAS" && r.category !== category) return false;
      if (year !== "TODOS" && !r.relprev_date.startsWith(year)) return false;
      if (!q) return true;
      return [r.title, r.summary, r.keywords, r.category, r.file_name]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [relprevs, search, category, year]);

  async function create() {
    if (!form.title.trim()) {
      toast.error("Informe o título do RELPREV.");
      return;
    }
    setSaving(true);
    try {
      let file_path = "";
      let file_name = "";
      if (file) {
        const up = await uploadFile("relprevs", file);
        file_path = up.path;
        file_name = up.name;
      }
      const { error } = await supabase.from("relprevs").insert({
        title: form.title.trim(),
        relprev_date: form.relprev_date,
        summary: form.summary.trim(),
        category: form.category,
        keywords: form.keywords.trim(),
        external_url: form.external_url.trim(),
        file_path,
        file_name,
        created_by: profile?.id ?? null,
        created_by_name: displayName(profile),
      });
      if (error) throw error;
      setForm({ ...EMPTY });
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await invalidate();
      toast.success("RELPREV arquivado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function open(path: string) {
    try {
      const url = await openFile(path);
      window.open(url, "_blank", "noreferrer");
    } catch {
      toast.error("Não foi possível abrir o arquivo.");
    }
  }

  async function remove(id: string, path: string) {
    const { error } = await supabase.from("relprevs").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await removeFile(path);
    await invalidate();
  }

  return (
    <Card className="mb-5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
          RELPREVs anteriores
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Título / assunto</Label>
            <Input
              className="mt-1"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data</Label>
              <Input
                className="mt-1"
                type="date"
                value={form.relprev_date}
                onChange={(e) => setForm((f) => ({ ...f, relprev_date: e.target.value }))}
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELPREV_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label>Resumo</Label>
            <Textarea
              className="mt-1"
              rows={2}
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            />
          </div>
          <div>
            <Label>Arquivo do RELPREV</Label>
            <Input
              ref={fileRef}
              className="mt-1"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Palavras-chave</Label>
              <Input
                className="mt-1"
                value={form.keywords}
                onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
              />
            </div>
            <div>
              <Label>Link externo</Label>
              <Input
                className="mt-1"
                placeholder="https://…"
                value={form.external_url}
                onChange={(e) => setForm((f) => ({ ...f, external_url: e.target.value }))}
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <Button onClick={create} disabled={saving} size="sm">
              {saving ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-4 w-4" />
              )}
              Arquivar RELPREV
            </Button>
          </div>
        </div>

        <div className="grid gap-2 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_12rem_10rem]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Pesquisar RELPREV"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas as categorias</SelectItem>
              {RELPREV_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os anos</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum RELPREV arquivado com esses filtros.
          </p>
        ) : (
          <div className="space-y-2">
            {list.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {r.category} · {formatDatePtBr(r.relprev_date)} · {r.created_by_name || "—"}
                  </p>
                  <p className="mt-0.5 font-semibold">{r.title}</p>
                  {r.summary && (
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{r.summary}</p>
                  )}
                  {r.keywords && <p className="mt-1 text-xs text-muted-foreground">#{r.keywords}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.file_path && (
                      <Button size="sm" variant="outline" onClick={() => open(r.file_path)}>
                        <FileText className="mr-1.5 h-3.5 w-3.5" />
                        {r.file_name || "Abrir arquivo"}
                      </Button>
                    )}
                    {r.external_url && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={r.external_url} target="_blank" rel="noreferrer">
                          Link <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remover RELPREV"
                  onClick={() => remove(r.id, r.file_path)}
                >
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
