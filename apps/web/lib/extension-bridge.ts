import type { BridgeMessage, SessionPayload, BlockerPayload } from "@focal/shared";

const PARENT_TARGET = "*";

export function isEmbeddedExtension(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.parent !== window;
  } catch {
    return false;
  }
}

export function postToExtension(message: BridgeMessage): void {
  if (!isEmbeddedExtension()) return;
  window.parent.postMessage(message, PARENT_TARGET);
}

export function requestSessionFromExtension(): Promise<SessionPayload | null> {
  return new Promise((resolve) => {
    if (!isEmbeddedExtension()) {
      resolve(null);
      return;
    }
    const onMessage = (event: MessageEvent) => {
      const data = event.data as BridgeMessage<SessionPayload | null> | undefined;
      if (!data || data.type !== "FOCAL_SESSION") return;
      window.removeEventListener("message", onMessage);
      resolve(data.payload ?? null);
    };
    window.addEventListener("message", onMessage);
    postToExtension({ type: "FOCAL_GET_SESSION" });
    window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve(null);
    }, 1500);
  });
}

export function notifyExtensionSession(session: SessionPayload | null): void {
  if (!isEmbeddedExtension()) return;
  if (session) {
    postToExtension({ type: "FOCAL_SET_SESSION", payload: session });
  } else {
    postToExtension({ type: "FOCAL_CLEAR_SESSION" });
  }
}

export function notifyExtensionBlocker(payload: BlockerPayload): void {
  postToExtension({ type: "FOCAL_UPDATE_BLOCKER", payload });
}

export function announceChildReady(): void {
  postToExtension({ type: "FOCAL_CHILD_READY" });
}
