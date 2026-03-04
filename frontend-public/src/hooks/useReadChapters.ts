import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "read_chapters_history";

export function useReadChapters() {
    const [readChapters, setReadChapters] = useState<number[]>([]);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                setReadChapters(JSON.parse(stored));
            }
        } catch (e) {
            console.error("Failed to load read chapters from local storage", e);
        }
    }, []);

    const markAsRead = useCallback((chapterId: number) => {
        setReadChapters((prev) => {
            if (prev.includes(chapterId)) {
                return prev; // already read
            }
            const updated = [...prev, chapterId];
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            } catch (e) {
                console.error("Failed to save read chapters to local storage", e);
            }
            return updated;
        });
    }, []);

    const isRead = useCallback(
        (chapterId: number) => {
            return readChapters.includes(chapterId);
        },
        [readChapters]
    );

    return {
        readChapters,
        markAsRead,
        isRead,
    };
}
