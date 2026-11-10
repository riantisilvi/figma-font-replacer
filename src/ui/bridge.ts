import type { CodeToUi, UiToCode } from "../shared/types";

export function send(message: UiToCode): void {
  parent.postMessage({ pluginMessage: message }, "*");
}

export function listen(handler: (message: CodeToUi) => void): () => void {
  const onMessage = (event: MessageEvent) => {
    const message = event.data?.pluginMessage as CodeToUi | undefined;
    if (message && typeof message === "object" && "type" in message) handler(message);
  };
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
