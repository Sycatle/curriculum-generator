/**
 * Tiny history stack for undo/redo.
 *
 * The stack stores immutable snapshots and a `cursor` index. push() drops any
 * "future" snapshots (standard undo semantics) and caps the stack at `max`.
 *
 * Generic over T so it can wrap any serialisable state — typed as CvInput at
 * the call site in cv-editor.
 */
export type HistoryState<T> = {
  past: T[];
  present: T;
  future: T[];
};

const MAX = 50;

export function init<T>(present: T): HistoryState<T> {
  return { past: [], present, future: [] };
}

export function push<T>(state: HistoryState<T>, next: T): HistoryState<T> {
  if (Object.is(state.present, next)) return state;
  const past = [...state.past, state.present];
  if (past.length > MAX) past.shift();
  return { past, present: next, future: [] };
}

export function undo<T>(state: HistoryState<T>): HistoryState<T> {
  if (state.past.length === 0) return state;
  const previous = state.past[state.past.length - 1] as T;
  return {
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future],
  };
}

export function redo<T>(state: HistoryState<T>): HistoryState<T> {
  if (state.future.length === 0) return state;
  const next = state.future[0] as T;
  return {
    past: [...state.past, state.present],
    present: next,
    future: state.future.slice(1),
  };
}

export function canUndo<T>(state: HistoryState<T>) {
  return state.past.length > 0;
}

export function canRedo<T>(state: HistoryState<T>) {
  return state.future.length > 0;
}
