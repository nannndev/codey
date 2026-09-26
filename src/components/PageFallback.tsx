import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

/** Shown while a page's code downloads. Waits a beat so fast loads never flash a spinner. */
export function PageFallback() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 250);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="workspace-shell grid min-h-screen place-items-center bg-background" aria-busy="true">
      {visible && (
        <span className="flex items-center gap-2 text-sm text-muted-foreground animate-fade-in">
          <LoaderCircle className="size-4 animate-spin" /> Loading…
        </span>
      )}
    </div>
  );
}
