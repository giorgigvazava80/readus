export type ReadingFontSize = "small" | "medium" | "big";

const STORAGE_KEY = "readus_reader_font_size";
const DEFAULT_FONT_SIZE: ReadingFontSize = "medium";
const VALID_FONT_SIZES = new Set<ReadingFontSize>(["small", "medium", "big"]);

export const readingFontSizeOptions: Array<{ value: ReadingFontSize; label: string }> = [
  { value: "small", label: "small/პატარა" },
  { value: "medium", label: "medium/საშუალო" },
  { value: "big", label: "big/დიდი" },
];

export const readingFontSizeClassByPreference: Record<ReadingFontSize, string> = {
  small: "reader-font-size-small",
  medium: "reader-font-size-medium",
  big: "reader-font-size-big",
};

function normalizeFontSize(value: string | null): ReadingFontSize {
  if (value && VALID_FONT_SIZES.has(value as ReadingFontSize)) {
    return value as ReadingFontSize;
  }
  return DEFAULT_FONT_SIZE;
}

export function getStoredReadingFontSize(): ReadingFontSize {
  if (typeof window === "undefined") {
    return DEFAULT_FONT_SIZE;
  }
  try {
    return normalizeFontSize(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_FONT_SIZE;
  }
}

export function setStoredReadingFontSize(size: ReadingFontSize): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, size);
  } catch {
    // Best effort persistence only.
  }
}
