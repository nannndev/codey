import { cn } from "@/lib/utils";
import { TEXT_LANGUAGE_NAMES, type TextLanguage } from "@/lib/text-practice";

const FLAGS: Record<TextLanguage, string> = { english: "EN", indonesian: "ID" };

/** English or Indonesian words for the Words practice. */
export function TextLanguagePicker({ selected, onSelect, disabled }: { selected: TextLanguage; onSelect: (language: TextLanguage) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border bg-background/60 p-0.5" role="group" aria-label="Word list language">
      {(Object.keys(TEXT_LANGUAGE_NAMES) as TextLanguage[]).map((language) => (
        <button
          key={language}
          type="button"
          disabled={disabled}
          aria-pressed={selected === language}
          onClick={() => onSelect(language)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
            selected === language ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <span className="font-mono text-[10px] opacity-70">{FLAGS[language]}</span>
          {TEXT_LANGUAGE_NAMES[language]}
        </button>
      ))}
    </div>
  );
}
