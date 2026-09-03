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
    label: "🌐 Repo Kode GitHub",
    icon: Code2,
    description: "Kode real-world dari proyek populer GitHub",
  },
  {
    id: "symbols",
    label: "⚡ Drill Simbol & Operator",
    icon: Zap,
    description: "Asah kelincahan ngetik kurung {}, =>, ?, dan simbol rumit",
  },
  {
    id: "terminal",
    label: "💻 Terminal & Git Workflow",
    icon: Terminal,
    description: "Latihan ngetik command Bash, Git, Docker & Kubernetes",
  },
  {
    id: "algorithms",
    label: "🧩 Algoritma & LeetCode",
    icon: Cpu,
    description: "Pola algoritma umum: Binary Search, BFS, DP, dll.",
  },
];

export function DevPracticeSelector({ activeCategory, onSelectCategory, disabled }: DevPracticeSelectorProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-card/65 p-1.5 backdrop-blur-sm">
        {CATEGORIES.map(({ id, label, icon: Icon }) => {
          const isActive = activeCategory === id;
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectCategory(id)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-md scale-[1.02]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
            >
              <Icon className="size-3.5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
