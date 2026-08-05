import { useState } from "react";

const STORAGE_KEY = "bonsai_custom_tags";

function readFromStorage(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function useCustomTags() {
  const [customTags, setCustomTags] = useState<string[]>(readFromStorage);

  const addCustomTag = (tag: string) => {
    setCustomTags((prev) => {
      if (prev.includes(tag)) return prev;
      const next = [...prev, tag].sort();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return { customTags, addCustomTag };
}
