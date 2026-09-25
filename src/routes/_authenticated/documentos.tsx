import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Loader2, Search, Trash2, Upload, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
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
import { useDocuments, uploadFile, openFile, removeFile } from "@/lib/data";
import { DOC_CATEGORIES, todayISO, formatDatePtBr } from "@/lib/evv";

export const Route = createFileRoute("/_authenticated/documentos")({
  head: () => ({
    meta: [
      { title: "Documentos — EVV" },
      {
        name: "description",
        content:
          "Biblioteca permanente do voo a vela: manuais, minutas de voo, procedimentos e documentos administrativos.",
      },
      { property: "og:title", content: "Documentos — EVV" },
      {
        property: "og:description",
        content: "Manuais, minutas e procedimentos sempre disponíveis para consulta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocumentosPage,
});

const EMPTY = {
  title: "",
  description: "",
  category: DOC_CATEGORIES[0]!,
  doc_date: todayISO(),
  keywords: "",
  external_url: "",
};

function DocumentosPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const { data: docs, isLoading } = useDocuments();
  const [form, setForm] = useState({ ...EMPTY });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("TODAS");
  const fileRef = useRef<HTMLInputElement>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["documents"] });

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (docs ?? []).filter((d) => {
      if (filter !== "TODAS" && d.category !== filter) return false;
      if (!q) return true;
      return [d.title, d.description, d.keywords, d.category, d.file_name]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [docs, search, filter]);

  async function create() {
    if (!form.title.trim()) {
      toast.error("Informe o título do documento.");
      return;
    }
    if (!file && !form.external_url.trim()) {
      toast.error("Anexe um arquivo ou informe um link.");
      return;
    }
    setSaving(true);
    try {
      let file_path = "";
      let file_name = "";
      if (file) {
        const up = await uploadFile("documentos", file);
        file_path = up.path;
        file_name = up.name;
      }
      const { error } = await supabase.from("documents").insert({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        doc_date: form.doc_date,
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
      toast.success("Documento publicado.");
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
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await removeFile(path);
    await invalidate();
    toast.success("Documento removido.");
  }

  return (
    <>
      <PageHeader
        title="Documentos"
        description="Biblioteca permanente: manuais, minutas e procedimentos"
      />

      <Card className="mb-5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
            Novo documento
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Título</Label>
            <Input
              className="mt-1"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
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
                {DOC_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data do documento</Label>
            <Input
              className="mt-1"
              type="date"
              value={form.doc_date}
              onChange={(e) => setForm((f) => ({ ...f, doc_date: e.target.value }))}
            />
          </div>
          <div>
            <Label>Palavras-chave</Label>
            <Input
              className="mt-1"
              placeholder="ex.: planador, checklist, reboque"
              value={form.keywords}
              onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Descrição</Label>
            <Textarea
              className="mt-1"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <Label>Arquivo (PDF, imagem, planilha…)</Label>
            <Input
              ref={fileRef}
              className="mt-1"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <Label>Ou link externo</Label>
            <Input
              className="mt-1"
              placeholder="https://…"
              value={form.external_url}
              onChange={(e) => setForm((f) => ({ ...f, external_url: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={create} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-4 w-4" />
              )}
              Publicar documento
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Pesquisar por título, palavra-chave ou descrição"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS">Todas as categorias</SelectItem>
            {DOC_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum documento encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((d) => (
            <Card key={d.id}>
              <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {d.category} · {formatDatePtBr(d.doc_date)}
                  </p>
                  <p className="mt-0.5 font-semibold">{d.title}</p>
                  {d.description && (
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {d.description}
                    </p>
                  )}
                  {d.keywords && (
                    <p className="mt-1 text-xs text-muted-foreground">#{d.keywords}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {d.file_path && (
                      <Button size="sm" variant="outline" onClick={() => open(d.file_path)}>
                        <FileText className="mr-1.5 h-3.5 w-3.5" />
                        {d.file_name || "Abrir arquivo"}
                      </Button>
                    )}
                    {d.external_url && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={d.external_url} target="_blank" rel="noreferrer">
                          Link <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remover documento"
                  onClick={() => remove(d.id, d.file_path)}
                >
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
