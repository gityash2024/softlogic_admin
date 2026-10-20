import { createContext, Dispatch, ReactNode, SetStateAction, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';

const DirtyContext = createContext<(id: string, dirty: boolean, discard: () => void) => void>(() => undefined);

export function AiUnsavedBoundary({ children }: { children: ReactNode }) {
  const [sections, setSections] = useState<Map<string, () => void>>(new Map());
  const register = useCallback((id: string, dirty: boolean, discard: () => void) => setSections(current => {
    if ((!dirty && !current.has(id)) || (dirty && current.get(id) === discard)) return current;
    const next = new Map(current);
    if (dirty) next.set(id, discard); else next.delete(id);
    return next;
  }), []);
  const dirty = sections.size > 0;
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty &&
    currentLocation.pathname + currentLocation.search !== nextLocation.pathname + nextLocation.search);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm('Discard unsaved AI changes and leave this section?')) {
      sections.forEach(discard => discard());
      blocker.proceed();
    }
    else blocker.reset();
  }, [blocker, sections]);
  useBeforeUnload(useCallback(event => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  }, [dirty]));
  return <DirtyContext.Provider value={register}>{children}{dirty && <div className="ai-draft-notice" role="status">Unsaved changes · Save this section before leaving.</div>}</DirtyContext.Provider>;
}

export function useAiDirty(dirty: boolean, onDiscard?: () => void) {
  const id = useId();
  const register = useContext(DirtyContext);
  const handler = useRef(onDiscard);
  handler.current = onDiscard;
  const discard = useCallback(() => handler.current?.(), []);
  useEffect(() => { register(id, dirty, discard); return () => register(id, false, discard); }, [dirty, discard, id, register]);
}

/** Refresh hydrates clean forms; acknowledgments apply only to their submitted draft/target. */
export function useAiDraft<T>(serverValue: T, identity?: string | number): [T, Dispatch<SetStateAction<T>>, (submitted: T, submittedIdentity?: string | number) => void] {
  const encoded = JSON.stringify(serverValue);
  const incoming = useMemo(() => JSON.parse(encoded) as T, [encoded]);
  const [draft, setDraftState] = useState<T>(serverValue);
  const [dirty, setDirty] = useState(false);
  const edited = useRef(false);
  const current = useRef({ draft, incoming, identity });
  current.current = { draft, incoming, identity };
  const previousIdentity = useRef(identity);
  useEffect(() => {
    if (previousIdentity.current !== identity) {
      previousIdentity.current = identity;
      edited.current = false;
      setDirty(false);
    }
    if (!edited.current) {
      current.current.draft = incoming;
      setDraftState(incoming);
    }
  }, [incoming, identity]);
  const setDraft = useCallback<Dispatch<SetStateAction<T>>>(next => {
    edited.current = true;
    setDirty(true);
    const value = typeof next === 'function' ? (next as (value: T) => T)(current.current.draft) : next;
    current.current.draft = value;
    setDraftState(value);
  }, []);
  const saved = useCallback((submitted: T, submittedIdentity = identity) => {
    if (current.current.identity !== submittedIdentity || JSON.stringify(current.current.draft) !== JSON.stringify(submitted)) return;
    edited.current = false;
    setDirty(false);
    current.current.draft = current.current.incoming;
    setDraftState(current.current.incoming);
  }, [identity]);
  useAiDirty(dirty, () => {
    edited.current = false;
    setDirty(false);
    current.current.draft = incoming;
    setDraftState(incoming);
  });
  return [draft, setDraft, saved];
}
