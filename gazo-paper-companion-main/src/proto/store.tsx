import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { newDraft, type Draft } from "./model";

export type Settings = { theme: "light" | "dark"; defaultMode: "info" | "scan" };
type State = { drafts: Draft[]; currentId: string | null; settings: Settings };
export type SaveStatus = "idle" | "saving" | "saved" | "error";
const KEY = "gaso-proto-v1";

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { drafts: [], currentId: null, settings: { theme: "light", defaultMode: "info" } };
}

type Ctx = {
  state: State;
  save: SaveStatus;
  current: Draft | null;
  start: () => Draft;
  open: (id: string) => void;
  update: (fn: (d: Draft) => Draft) => void;
  remove: (id: string) => void;
  clearAll: () => void;
  setSettings: (s: Partial<Settings>) => void;
};
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(load);
  const [save, setSave] = useState<SaveStatus>("idle");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSave("saving");
    const h = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); setSave("saved"); }
      catch { setSave("error"); }
    }, 250);
    return () => clearTimeout(h);
  }, [state]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", state.settings.theme === "dark");
  }, [state.settings.theme]);

  const start = useCallback(() => {
    const d = newDraft();
    setState((s) => ({ ...s, drafts: [d, ...s.drafts], currentId: d.id }));
    return d;
  }, []);
  const open = useCallback((id: string) => setState((s) => ({ ...s, currentId: id })), []);
  const update = useCallback((fn: (d: Draft) => Draft) => {
    setState((s) => ({
      ...s,
      drafts: s.drafts.map((d) => (d.id === s.currentId ? { ...fn(d), updatedAt: Date.now() } : d)),
    }));
  }, []);
  const remove = useCallback((id: string) => setState((s) => ({ ...s, drafts: s.drafts.filter((d) => d.id !== id), currentId: s.currentId === id ? null : s.currentId })), []);
  const clearAll = useCallback(() => setState((s) => ({ ...s, drafts: [], currentId: null })), []);
  const setSettings = useCallback((p: Partial<Settings>) => setState((s) => ({ ...s, settings: { ...s.settings, ...p } })), []);

  const current = state.drafts.find((d) => d.id === state.currentId) ?? null;
  return (
    <StoreCtx.Provider value={{ state, save, current, start, open, update, remove, clearAll, setSettings }}>
      {children}
    </StoreCtx.Provider>
  );
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("StoreProvider missing");
  return c;
}
