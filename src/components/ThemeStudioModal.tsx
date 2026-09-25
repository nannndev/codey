import { Palette, X, Check } from "lucide-react";
import { usePreferences, type EditorTheme } from "@/components/PreferencesProvider";

interface ThemeStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ThemeOption {
  id: EditorTheme;
  name: string;
  author: string;
  bg: string;
  fg: string;
  keyword: string;
  string: string;
  comment: string;
  function: string;
}

export const THEMES: ThemeOption[] = [
  { id: "codey", name: "Codey Dark (Default)", author: "Codey", bg: "#09090b", fg: "#f4f4f5", keyword: "#38bdf8", string: "#facc15", comment: "#71717a", function: "#34d399" },
  { id: "tokyo", name: "Tokyo Night", author: "folke", bg: "#1a1b26", fg: "#a9b1d6", keyword: "#bb9af7", string: "#9ece6a", comment: "#565f89", function: "#7aa2f7" },
  { id: "catppuccin", name: "Catppuccin Macchiato", author: "Catppuccin", bg: "#1e1e2e", fg: "#cdd6f4", keyword: "#cba6f7", string: "#a6e3a1", comment: "#6c7086", function: "#89b4fa" },
  { id: "one-dark", name: "One Dark Pro", author: "Atom", bg: "#282c34", fg: "#abb2bf", keyword: "#c678dd", string: "#98c379", comment: "#5c6370", function: "#61afef" },
  { id: "dracula", name: "Dracula Neon", author: "Zeno Rocha", bg: "#282a36", fg: "#f8f8f2", keyword: "#ff79c6", string: "#f1fa8c", comment: "#6272a4", function: "#50fa7b" },
  { id: "nord", name: "Nord Frost", author: "Arctic Ice Studio", bg: "#2e3440", fg: "#d8dee9", keyword: "#81a1c1", string: "#a3be8c", comment: "#616e88", function: "#88c0d0" },
  { id: "synthwave", name: "Synthwave '84", author: "Robb Owen", bg: "#262335", fg: "#f0eff1", keyword: "#fef445", string: "#ff7edb", comment: "#614d85", function: "#36f9f6" },
  { id: "gruvbox", name: "Gruvbox Dark", author: "morhetz", bg: "#282828", fg: "#ebdbb2", keyword: "#fb4934", string: "#b8bb26", comment: "#928374", function: "#fabd2f" },
  { id: "cyberpunk", name: "Cyberpunk 2077", author: "CD Projekt Red", bg: "#0d0f18", fg: "#00f0ff", keyword: "#ff0055", string: "#ffe600", comment: "#52607b", function: "#00ff66" },
  { id: "github", name: "GitHub Light", author: "GitHub", bg: "#ffffff", fg: "#24292f", keyword: "#cf222e", string: "#0a3069", comment: "#6e7781", function: "#8250df" },
];

export function ThemeStudioModal({ isOpen, onClose }: ThemeStudioModalProps) {
  const { preferences, setPreference } = usePreferences();

  if (!isOpen) return null;

  function handleSelectTheme(themeId: EditorTheme) {
    setPreference("editorTheme", themeId);
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="IDE Theme Studio & Syntax Highlighter Customizer"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl animate-scale-in space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2.5">
            <Palette className="size-6 text-amber-500" />
            <div>
              <h3 className="font-bold text-lg tracking-tight text-foreground">IDE Theme Studio</h3>
              <p className="text-xs text-muted-foreground">Select your favorite syntax color palette for the coding playground.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close modal"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Theme Cards Grid */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {THEMES.map((theme) => {
            const isSelected = preferences.editorTheme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => handleSelectTheme(theme.id)}
                className={`group flex flex-col rounded-xl border p-4 text-left transition-all active:scale-[0.98] ${
                  isSelected
                    ? "border-amber-500/60 bg-amber-500/10 ring-2 ring-amber-500/50 shadow-xl"
                    : "border-border/60 bg-card/60 hover:border-foreground/30 hover:bg-card"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-extrabold text-foreground">{theme.name}</span>
                    <span className="block text-[10px] text-muted-foreground">by {theme.author}</span>
                  </div>
                  {isSelected && (
                    <span className="flex items-center gap-1 rounded-md bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                      <Check className="size-3" /> Active
                    </span>
                  )}
                </div>

                {/* Live Code Preview Snippet Box */}
                <div
                  className="rounded-lg p-3 font-mono text-xs overflow-hidden border shadow-inner transition-transform group-hover:scale-[1.01]"
                  style={{ backgroundColor: theme.bg, color: theme.fg, borderColor: `${theme.fg}22` }}
                >
                  <div className="flex items-center gap-1.5 mb-2 opacity-50">
                    <span className="size-2 rounded-full bg-red-400" />
                    <span className="size-2 rounded-full bg-yellow-400" />
                    <span className="size-2 rounded-full bg-green-400" />
                    <span className="text-[9px] ml-1">app.ts</span>
                  </div>
                  <div>
                    <span style={{ color: theme.comment }}>// calculate wpm speed</span>
                  </div>
                  <div>
                    <span style={{ color: theme.keyword }}>const</span>{" "}
                    <span style={{ color: theme.function }}>calculateSpeed</span> ={" "}
                    <span style={{ color: theme.keyword }}>async</span> () =&gt; &#123;
                  </div>
                  <div className="pl-4">
                    <span style={{ color: theme.keyword }}>return</span>{" "}
                    <span style={{ color: theme.string }}>"Codey Speed"</span>;
                  </div>
                  <div>&#125;;</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
