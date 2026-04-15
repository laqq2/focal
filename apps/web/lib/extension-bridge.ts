import type { BridgeMessage, SessionPayload, BlockerPayload } from "@focal/shared";

const PARENT_TARGET = "*";

/** Query flag appended by `apps/extension/newtab.js` to the iframe URL. */
export const FOCAL_EMBED_SEARCH_PARAM = "focal_embed";

/**
 * True only when this document is the Focal **extension** new-tab iframe — not any
 * other iframe (which would incorrectly block normal OAuth).
 */
export function isEmbeddedExtension(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.parent === window) return false;
    const v = new URLSearchParams(window.location.search).get(FOCAL_EMBED_SEARCH_PARAM);
    if (v === "1" || v === "true") return true;
    const ref = typeof document !== "undefined" ? document.referrer : "";
    if (
      ref.startsWith("chrome-extension://") ||
      ref.startsWith("moz-extension://") ||
      ref.startsWith("safari-web-extension://")
    ) {
      return true;
    }
    return false;
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

/**
 * Opens the hosted login page. In the extension new tab iframe, asks the parent
 * to `chrome.tabs.create` (popups are blocked there); otherwise navigates this window.
 */
export function openExtensionLoginTab(url: string): void {
  if (!isEmbeddedExtension()) {
    window.location.assign(url);
    return;
  }
  postToExtension({ type: "FOCAL_OPEN_LOGIN_TAB", payload: url });
}
