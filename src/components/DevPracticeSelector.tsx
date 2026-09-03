import { Code2, Cpu, Terminal, Zap } from "lucide-react";

export type DevPracticeCategory = "public" | "symbols" | "terminal" | "algorithms";

interface DevPracticeSelectorProps {
  activeCategory: DevPracticeCategory;
  onSelectCategory: (cat: DevPracticeCategory) => void;
  disabled: boolean;
}

const CATEGORIES: { id: DevPracticeCategory; label: string; icon: React.ElementType; description: string }[] = [
  {
    id: "public",
    label: "Public Code",
    icon: Code2,
    description: "Standard repository code snippets",
  },
  {
    id: "symbols",
    label: "Symbol Drills",
    icon: Zap,
    description: "Operators, brackets & syntax muscle memory",
  },
  {
    id: "terminal",
    label: "Terminal & Git",
    icon: Terminal,
    description: "Git workflows, Docker & Bash commands",
  },
  {
    id: "algorithms",
    label: "Algorithms",
    icon: Cpu,
    description: "Binary search, BFS, DP & LeetCode patterns",
  },
];

export function DevPracticeSelector({ activeCategory, onSelectCategory, disabled }: DevPracticeSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-card/65 p-1.5 backdrop-blur-sm">
      {CATEGORIES.map(({ id, label, icon: Icon }) => {
        const isActive = activeCategory === id;
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => onSelectCategory(id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
          >
            <Icon className="size-3.5" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
