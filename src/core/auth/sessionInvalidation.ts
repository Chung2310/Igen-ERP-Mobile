export type SessionInvalidation = {
  code?: string;
  message?: string;
};

type Listener = (reason: SessionInvalidation) => void;
const listeners = new Set<Listener>();

export function subscribeToSessionInvalidation(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function notifySessionInvalidation(reason: SessionInvalidation) {
  for (const listener of listeners) listener(reason);
}
