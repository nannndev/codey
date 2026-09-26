import { BookOpen, Code2, Cpu, GitPullRequest, Terminal, Type, Zap } from "lucide-react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";

export type DevPracticeCategory = "public" | "symbols" | "terminal" | "algorithms" | "diff" | "words" | "passages";

/** Plain-text practice rather than code. */
export const TEXT_CATEGORIES: DevPracticeCategory[] = ["words", "passages"];

interface DevPracticeSelectorProps {
  activeCategory: DevPracticeCategory;
  onSelectCategory: (cat: DevPracticeCategory) => void;
  disabled: boolean;
}

const CATEGORIES: {
  id: DevPracticeCategory;
  label: string;
  badge?: string;
  icon: React.ElementType;
  description: string;
}[] = [
  {
    id: "public",
    label: "GitHub Repos",
    icon: Code2,
    description: "Real-world code from popular GitHub open-source repositories",
  },
  {
    id: "diff",
    label: "PR & Git Diffs",
    badge: "🔀",
    icon: GitPullRequest,
    description: "Practice typing real-world bug fixes and Pull Request code diffs",
  },
  {
    id: "symbols",
    label: "Symbol Drills",
    badge: "⚡",
    icon: Zap,
    description: "Sharpen speed typing brackets {}, =>, ?, and complex symbols",
  },
  {
    id: "terminal",
    label: "Terminal & Git",
    badge: "💻",
    icon: Terminal,
    description: "Practice typing Bash, Git, Docker & Kubernetes commands",
  },
  {
    id: "algorithms",
    label: "Algorithms",
    badge: "🧩",
    icon: Cpu,
    description: "Common algorithm patterns: Binary Search, BFS, DP, etc.",
  },
  {
    id: "words",
    label: "Words",
    icon: Type,
    description: "Plain text: the most common English or Indonesian words",
  },
  {
    id: "passages",
    label: "Passages",
    icon: BookOpen,
    description: "Plain text: passages from classic public-domain novels",
  },
];

export function DevPracticeSelector({ activeCategory, onSelectCategory, disabled }: DevPracticeSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-0.5" role="group" aria-label="Practice source">
      {CATEGORIES.map(({ id, label, icon: Icon, description }) => {
        const isActive = activeCategory === id;
        return (
          <Fragment key={id}>
          {/* Code sources first, then plain text. */}
          {id === "words" && <span className="mx-1 h-5 w-px bg-border" aria-hidden />}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelectCategory(id)}
            title={description}
            aria-pressed={isActive}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer select-none",
              isActive
                ? "bg-foreground text-background font-bold shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/70",
              disabled && "opacity-50 pointer-events-none"
            )}
          >
            <Icon className={cn("size-3.5 shrink-0", isActive ? "text-background" : "text-amber-500")} />
            <span>{label}</span>
          </button>
          </Fragment>
        );
      })}
    </div>
  );
}
