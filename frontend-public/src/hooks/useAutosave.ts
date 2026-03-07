import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface UseAutosaveOptions<T> {
  value: T;
  enabled: boolean;
  onSave: (value: T) => Promise<void>;
  delayMs?: number;
}

const DEFAULT_AUTOSAVE_DELAY_MS = 600;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Save failed";
}

export function useAutosave<T>({ value, enabled, onSave, delayMs = DEFAULT_AUTOSAVE_DELAY_MS }: UseAutosaveOptions<T>) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const valueRef = useRef(value);
  const baselineRef = useRef(JSON.stringify(value));
  const onSaveRef = useRef(onSave);
  const timerRef = useRef<number | null>(null);

  valueRef.current = value;
  onSaveRef.current = onSave;

  const serialized = useMemo(() => JSON.stringify(value), [value]);
  const hasUnsavedChanges = serialized !== baselineRef.current;

  const markSaved = useCallback((nextValue?: T) => {
    const target = nextValue !== undefined ? nextValue : valueRef.current;
    baselineRef.current = JSON.stringify(target);
    setLastSavedAt(new Date());
    setLastError(null);
  }, []);

  const saveNow = useCallback(async () => {
    if (!enabled || isSaving) {
      return;
    }

    const currentSerialized = JSON.stringify(valueRef.current);
    if (currentSerialized === baselineRef.current) {
      return;
    }

    setIsSaving(true);
    setLastError(null);

    try {
      await onSaveRef.current(valueRef.current);
      baselineRef.current = currentSerialized;
      setLastSavedAt(new Date());
    } catch (error) {
      setLastError(toErrorMessage(error));
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [enabled, isSaving]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Clear previous timer if value changes
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    // Only set a new timer if there are actually unsaved changes
    if (hasUnsavedChanges) {
      timerRef.current = window.setTimeout(() => {
        void saveNow();
      }, delayMs);
    }

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [enabled, delayMs, saveNow, hasUnsavedChanges]); // Depend on hasUnsavedChanges so the debounce restarts

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (enabled && hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = "";
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && enabled && hasUnsavedChanges) {
        void saveNow();
      }
    };

    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      // Auto-save on component unmount (e.g. user navigates to another page)
      if (enabled && hasUnsavedChanges) {
        void saveNow();
      }
    };
  }, [enabled, hasUnsavedChanges, saveNow]);

  return {
    isSaving,
    lastSavedAt,
    lastError,
    hasUnsavedChanges,
    saveNow,
    markSaved,
  };
}
