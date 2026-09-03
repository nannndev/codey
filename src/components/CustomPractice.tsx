import { useRef, useState } from "react";
import { FileUp, Link, LoaderCircle, LockKeyhole, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLanguages } from "@/data";
import { fetchCodeFromGistOrUrl, detectLanguageFromFilename } from "@/utils/gist-fetcher";
import type { Snippet } from "@/types";

export function CustomPractice({ onLoad }: { onLoad: (snippet: Snippet) => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"paste" | "gist">("paste");
  const [filename, setFilename] = useState("practice.txt");
  const [language, setLanguage] = useState("Plain Text");
  const [code, setCode] = useState("");
  const [gistUrl, setGistUrl] = useState("");
  const [loadingGist, setLoadingGist] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const languages = ["Plain Text", ...getLanguages().filter((item) => item !== "All")];

  const readFile = async (file: File) => {
    if (file.size > 100 * 1024) {
      setError("Ukuran file maksimal 100 KB.");
      return;
    }
    const text = await file.text();
    setFilename(file.name);
    setLanguage(detectLanguageFromFilename(file.name));
    setCode(text.replace(/\r\n/g, "\n").slice(0, 100_000));
    setError("");
  };

  const handleFetchGist = async () => {
    if (!gistUrl.trim()) {
      setError("Masukkan URL GitHub Gist atau raw file link yang valid.");
      return;
    }
    setError("");
    setLoadingGist(true);
    try {
      const fetchedSnippet = await fetchCodeFromGistOrUrl(gistUrl);
      onLoad(fetchedSnippet);
      setOpen(false);
      setGistUrl("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal mengambil kode dari Gist.");
    } finally {
      setLoadingGist(false);
    }
  };

  const start = () => {
    if (code.trim().length < 20) {
      setError("Minimal 20 karakter kode untuk memulai latihan.");
      return;
    }
    onLoad({ id: `custom-${Date.now()}`, filename, language, code: code.trimEnd(), sourceType: "custom" });
    setOpen(false);
  };

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5 text-xs font-semibold">
        <FileUp className="size-3.5 text-amber-500" /> Custom / Gist Practice
      </Button>
    );
  }

  return (
    <section className="rounded-2xl border bg-card/90 p-5 backdrop-blur-md shadow-xl transition-all animate-scale-in">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-foreground">📁 Latihan Kode Pribadi & Import Gist</h2>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <LockKeyhole className="size-3 text-emerald-400" /> Privasi aman — kode lokal hanya diproses di browsermu.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2 border-b border-border/60 pb-2">
        <button
          type="button"
          onClick={() => { setTab("paste"); setError(""); }}
          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
            tab === "paste" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <FileUp className="size-3.5" /> Paste & Upload File
        </button>
        <button
          type="button"
          onClick={() => { setTab("gist"); setError(""); }}
          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
            tab === "gist" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Link className="size-3.5" /> Import Gist / Raw Link
        </button>
      </div>

      {tab === "paste" ? (
        <>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void readFile(file);
            }}
          />
          <div className="mb-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} className="text-xs">
              <FileUp data-icon="inline-start" /> Pilih File Kode
            </Button>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="h-8 rounded-lg border bg-background px-3 text-xs font-medium"
            >
              {languages.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <input
              value={filename}
              onChange={(event) => setFilename(event.target.value)}
              className="h-8 min-w-40 flex-1 rounded-lg border bg-background px-3 text-xs font-mono"
              aria-label="Filename"
            />
          </div>
          <textarea
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Paste potongan kode milikmu di sini atau upload file source code..."
            className="min-h-40 w-full resize-y rounded-xl border bg-background p-3 font-mono text-xs leading-relaxed outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className={`text-[11px] font-medium ${error ? "text-destructive font-bold" : "text-muted-foreground"}`}>
              {error || `${code.length.toLocaleString()} karakter · batas max 100 KB`}
            </span>
            <Button type="button" size="sm" onClick={start} className="font-bold">
              Mulai Latihan Kode
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Masukkan link GitHub Gist publik (cth: <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[11px]">https://gist.github.com/user/gist_id</code>) atau raw GitHub file URL.
          </p>
          <div className="flex gap-2">
            <input
              value={gistUrl}
              onChange={(e) => setGistUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleFetchGist(); }}
              placeholder="https://gist.github.com/username/gist_id"
              className="h-10 flex-1 rounded-xl border bg-background px-3 text-xs font-mono outline-none focus:ring-2 focus:ring-primary/40"
            />
            <Button type="button" size="sm" onClick={handleFetchGist} disabled={loadingGist} className="font-bold h-10 px-4">
              {loadingGist ? <LoaderCircle className="size-4 animate-spin" /> : "Ambil & Latih Kode"}
            </Button>
          </div>
          {error && <p className="text-xs text-destructive font-semibold">{error}</p>}
        </div>
      )}
    </section>
  );
}
