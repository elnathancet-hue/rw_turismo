import { useCallback, useRef, useState } from "react";

const MAX_HISTORY = 100;
// Edits with the same coalesce key within this window collapse into one
// history entry, so undo reverts whole phrases instead of keystrokes.
const COALESCE_WINDOW_MS = 900;

type History<T> = { past: T[]; present: T; future: T[] };

export type SetWithHistory<T> = (
  updater: (current: T) => T,
  options?: { coalesce?: string }
) => void;

const useHistory = <T,>(initial: T) => {
  const [history, setHistory] = useState<History<T>>({
    past: [],
    present: initial,
    future: [],
  });
  const lastEdit = useRef<{ key: string | null; at: number }>({
    key: null,
    at: 0,
  });

  const set = useCallback<SetWithHistory<T>>((updater, options) => {
    const now = Date.now();
    const coalesce =
      !!options?.coalesce &&
      options.coalesce === lastEdit.current.key &&
      now - lastEdit.current.at < COALESCE_WINDOW_MS;
    lastEdit.current = { key: options?.coalesce ?? null, at: now };

    setHistory((current) => ({
      past: coalesce
        ? current.past
        : [...current.past, current.present].slice(-MAX_HISTORY),
      present: updater(current.present),
      future: [],
    }));
  }, []);

  const undo = useCallback(() => {
    lastEdit.current = { key: null, at: 0 };
    setHistory((current) => {
      if (current.past.length === 0) return current;
      return {
        past: current.past.slice(0, -1),
        present: current.past[current.past.length - 1],
        future: [current.present, ...current.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    lastEdit.current = { key: null, at: 0 };
    setHistory((current) => {
      if (current.future.length === 0) return current;
      return {
        past: [...current.past, current.present].slice(-MAX_HISTORY),
        present: current.future[0],
        future: current.future.slice(1),
      };
    });
  }, []);

  // Replaces the whole state without creating an undo step (initial load).
  const reset = useCallback((value: T) => {
    lastEdit.current = { key: null, at: 0 };
    setHistory({ past: [], present: value, future: [] });
  }, []);

  return {
    value: history.present,
    set,
    undo,
    redo,
    reset,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
};

export default useHistory;
