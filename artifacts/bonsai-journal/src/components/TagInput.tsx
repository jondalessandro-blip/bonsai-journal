import { useState, useRef, KeyboardEvent } from "react";
import { X } from "lucide-react";
import { DEFAULT_TAGS } from "@/data/defaultTags";
import { useCustomTags } from "@/hooks/useCustomTags";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
}

export function TagInput({ value, onChange }: TagInputProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { customTags, addCustomTag } = useCustomTags();

  const allSuggestions = [
    ...DEFAULT_TAGS,
    ...customTags.filter((t) => !(DEFAULT_TAGS as readonly string[]).includes(t)),
  ].filter((t) => !value.includes(t));

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase().slice(0, 20);
    if (!tag || value.includes(tag)) return;
    onChange([...value, tag]);
    if (!(DEFAULT_TAGS as readonly string[]).includes(tag)) {
      addCustomTag(tag);
    }
    setInput("");
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  return (
    <div className="space-y-3">
      {/* Selected tags */}
      <div
        className="flex flex-wrap gap-1.5 min-h-[38px] w-full rounded-md border border-input bg-background px-3 py-2 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: "#E0F2F1", color: "#00695C" }}
          >
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
              className="hover:opacity-70 transition-opacity"
              aria-label={`Remove ${tag}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? "Type a tag and press Enter…" : ""}
          className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          maxLength={20}
        />
      </div>

      {/* Suggestion chips */}
      {allSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allSuggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className="px-2 py-0.5 rounded-full text-xs border border-dashed border-[#00695C]/40 text-[#00695C]/80 hover:bg-[#E0F2F1] hover:border-[#00695C] transition-colors"
            >
              + {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
