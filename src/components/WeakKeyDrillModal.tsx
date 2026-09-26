import { useState } from "react";
import { Target, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WeakKeys } from "@/components/WeakKeys";
import type { Snippet } from "@/types";

export function WeakKeyDrillModal({ onDrill }: { onDrill: (snippet: Snippet) => void }) {
  const [open, setOpen] = useState(false);

  const handleDrillStart = (snippet: Snippet) => {
    setOpen(false);
    onDrill(snippet);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((prev) => !prev)}
        title="Drill the keys you miss most"
        className="h-8 border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-300 hover:bg-purple-500/20 hover:text-purple-700 dark:hover:text-purple-200 transition-colors"
      >
        <Target data-icon="inline-start" className="size-3.5" />
        Weak keys
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl rounded-2xl border bg-card p-5 shadow-2xl animate-scale-in">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Targeted Practice & Drills
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <WeakKeys onDrill={handleDrillStart} />
          </div>
        </div>
      )}
    </>
  );
}
