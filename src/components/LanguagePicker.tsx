import { useRef } from "react";
import {
  ChevronDown,
  CloudDownload,
  Code2,
  Database,
  LayoutGrid,
} from "lucide-react";
import {
  siC,
  siCss,
  siDart,
  siDocker,
  siElixir,
  siFlutter,
  siGnubash,
  siGo,
  siGraphql,
  siJavascript,
  siKotlin,
  siLua,
  siPhp,
  siPython,
  siReact,
  siRust,
  siSwift,
  siTerraform,
  siTypescript,
  siYaml,
  siZig,
  type SimpleIcon,
} from "simple-icons";
import { cn } from "@/lib/utils";

interface LanguagePickerProps {
  languages: string[];
  selected: string;
  onSelect: (lang: string) => void;
  disabled: boolean;
  loading?: boolean;
}

const LANGUAGE_ICONS: Record<string, SimpleIcon> = {
  Bash: siGnubash,
  C: siC,
  CSS: siCss,
  Dart: siDart,
  Dockerfile: siDocker,
  Elixir: siElixir,
  Flutter: siFlutter,
  Go: siGo,
  GraphQL: siGraphql,
  JavaScript: siJavascript,
  Kotlin: siKotlin,
  Lua: siLua,
  PHP: siPhp,
  Python: siPython,
  React: siReact,
  Rust: siRust,
  Swift: siSwift,
  Terraform: siTerraform,
  TypeScript: siTypescript,
  YAML: siYaml,
  Zig: siZig,
};

function LanguageIcon({ language, className }: { language: string; className?: string }) {
  if (language === "All") return <LayoutGrid aria-hidden="true" className={className} />;
  if (language === "SQL") return <Database aria-hidden="true" className={className} />;

  const icon = LANGUAGE_ICONS[language];
  if (!icon) return <Code2 aria-hidden="true" className={className} />;

  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d={icon.path} />
    </svg>
  );
}

export function LanguagePicker({ languages, selected, onSelect, disabled, loading = false }: LanguagePickerProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const selectLanguage = (language: string) => {
    onSelect(language);
    detailsRef.current?.removeAttribute("open");
  };

  return (
    <div className="relative z-30 flex items-center justify-between gap-4 rounded-xl glass-card px-3.5 py-2.5 shadow-sm">
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-sans">Practice Ecosystem</div>
        <div className="truncate text-xs text-muted-foreground font-medium mt-0.5">Filter codebase language for next run</div>
      </div>

      <details ref={detailsRef} className="group relative shrink-0">
        <summary
          className={cn(
            "flex h-9 min-w-40 list-none items-center gap-2 rounded-xl border border-border/70 bg-background/80 px-3 text-xs font-semibold shadow-xs transition-all hover:bg-muted hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer [&::-webkit-details-marker]:hidden",
            disabled && "pointer-events-none opacity-50",
          )}
          aria-disabled={disabled}
        >
          <span className="grid size-5 place-items-center rounded-md bg-amber-500/15 text-amber-500">
            <LanguageIcon language={selected} className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1 truncate text-left">{selected}</span>
          {loading ? (
            <CloudDownload aria-label="Fetching source code" className="size-3.5 animate-pulse text-amber-500" />
          ) : (
            <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
          )}
        </summary>

        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 grid max-h-72 w-64 grid-cols-2 gap-1 overflow-y-auto rounded-2xl border border-border/80 bg-popover/95 p-2 text-popover-foreground shadow-2xl backdrop-blur-xl animate-fade-in-up">
          {languages.map((language) => (
            <button
              key={language}
              type="button"
              onClick={() => selectLanguage(language)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium transition-all hover:bg-muted cursor-pointer",
                language === selected && "bg-foreground text-background font-bold shadow-xs hover:bg-foreground/90 hover:text-background",
              )}
            >
              <LanguageIcon language={language} className="size-3.5 shrink-0" />
              <span className="truncate">{language}</span>
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
