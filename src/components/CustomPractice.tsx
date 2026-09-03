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
      setError("Maximum file size is 100 KB.");
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
      setError("Enter a GitHub Gist URL or raw file link.");
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
      setError(err instanceof Error ? err.message : "Failed to load Gist.");
    } finally {
      setLoadingGist(false);
    }
  };

  const start = () => {
    if (code.trim().length < 20) {
      setError("Add at least 20 characters of code.");
      return;
    }
    onLoad({ id: `custom-${Date.now()}`, filename, language, code: code.trimEnd(), sourceType: "custom" });
    setOpen(false);
  };

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileUp data-icon="inline-start" /> Custom / Gist Practice
      </Button>
    );
  }

  return (
    <section className="rounded-xl border bg-card/85 p-4 backdrop-blur-sm shadow-md">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold">Custom Practice & Import</h2>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <LockKeyhole className="size-3" /> Practice local code or import directly from GitHub Gist.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-3 flex gap-2 border-b pb-2">
        <button
          type="button"
          onClick={() => { setTab("paste"); setError(""); }}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
            tab === "paste" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <FileUp className="size-3.5" /> Paste / Upload File
        </button>
        <button
          type="button"
          onClick={() => { setTab("gist"); setError(""); }}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
            tab === "gist" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Link className="size-3.5" /> Import Gist / Raw URL
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
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              <FileUp data-icon="inline-start" /> Upload file
            </Button>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="h-8 rounded-md border bg-background px-3 text-xs"
            >
              {languages.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <input
              value={filename}
              onChange={(event) => setFilename(event.target.value)}
              className="h-8 min-w-40 flex-1 rounded-md border bg-background px-3 text-xs"
              aria-label="Filename"
            />
          </div>
          <textarea
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Paste code here, or upload any text-based source file..."
            className="min-h-40 w-full resize-y rounded-lg border bg-background p-3 font-mono text-xs leading-relaxed outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className={`text-[11px] ${error ? "text-destructive" : "text-muted-foreground"}`}>
              {error || `${code.length.toLocaleString()} characters · 100 KB max`}
            </span>
            <Button type="button" size="sm" onClick={start}>
              Start local practice
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Paste a public GitHub Gist link (e.g. <code className="bg-muted px-1 rounded">https://gist.github.com/user/gist_id</code>) or a raw GitHub file URL.
          </p>
          <div className="flex gap-2">
            <input
              value={gistUrl}
              onChange={(e) => setGistUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleFetchGist(); }}
              placeholder="https://gist.github.com/username/gist_id"
              className="h-9 flex-1 rounded-md border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-ring"
            />
            <Button type="button" size="sm" onClick={handleFetchGist} disabled={loadingGist}>
              {loadingGist ? <LoaderCircle className="size-4 animate-spin" /> : "Fetch & Practice"}
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </section>
  );
}
