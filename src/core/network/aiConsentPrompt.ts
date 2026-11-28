export type AiDisclosure = { version: string; title: string; description: string; providers: Array<{ name: string; url: string; purpose: string }>; withdrawal: string };
type Prompt = { disclosure?: AiDisclosure; resolve: (accepted: boolean) => void };
let listener: ((prompt: Prompt | null) => void) | undefined;
let pending: Promise<boolean> | undefined;
let finish: ((accepted: boolean) => void) | undefined;
export function subscribeAiConsentPrompt(handler: (prompt: Prompt | null) => void) {
  listener = handler;
  return () => { finish?.(false); listener = undefined; };
}
export function cancelAiConsentPrompt() { finish?.(false); }
export function requestAiConsentPrompt(disclosure?: AiDisclosure): Promise<boolean> {
  if (pending) return pending;
  if (!listener) return Promise.resolve(false);
  let resolvePending!: (value: boolean) => void;
  const promise = new Promise<boolean>(resolve => { resolvePending = resolve; });
  pending = promise;
  {
    const settle = (accepted: boolean) => {
      if (finish !== settle) return;
      pending = undefined; finish = undefined; listener?.(null); resolvePending(accepted);
    };
    finish = settle;
    listener!({ disclosure, resolve: settle });
  }
  return promise;
}
