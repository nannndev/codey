import { Code2, Cpu, GitPullRequest, Terminal, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type DevPracticeCategory = "public" | "symbols" | "terminal" | "algorithms" | "diff";

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
];

export function DevPracticeSelector({ activeCategory, onSelectCategory, disabled }: DevPracticeSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5 glass-card rounded-xl p-1.5">
        {CATEGORIES.map(({ id, label, icon: Icon, badge, description }) => {
          const isActive = activeCategory === id;
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectCategory(id)}
              title={description}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all duration-150 cursor-pointer select-none",
                isActive
                  ? "bg-foreground text-background font-bold shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/70",
                disabled && "opacity-50 pointer-events-none"
              )}
            >
              <Icon className={cn("size-3.5 shrink-0", isActive ? "text-background" : "text-amber-500")} />
              <span>{label}</span>
              {badge && <span className="text-[11px] leading-none opacity-80">{badge}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
