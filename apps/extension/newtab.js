/* global chrome */

const frame = document.getElementById("app");

async function loadConfig() {
  const url = chrome.runtime.getURL("config.json");
  const res = await fetch(url);
  const json = await res.json();
  return json.appUrl || "http://localhost:3000/app";
}

/** Must match `FOCAL_EMBED_SEARCH_PARAM` in the web app (`extension-bridge.ts`). */
function withFocalEmbedParam(url) {
  try {
    const u = new URL(url);
    if (!u.searchParams.get("focal_embed")) u.searchParams.set("focal_embed", "1");
    return u.toString();
  } catch {
    const join = url.includes("?") ? "&" : "?";
    return url.includes("focal_embed=") ? url : `${url}${join}focal_embed=1`;
  }
}

function sendToFrame(message) {
  if (!frame?.contentWindow) return;
  frame.contentWindow.postMessage(message, "*");
}

chrome.storage.local.get(["focal_session", "focal_app_url"], async (data) => {
  const raw = data.focal_app_url || (await loadConfig());
  const src = withFocalEmbedParam(raw);
  if (frame) frame.src = src;
});

window.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "FOCAL_CHILD_READY") {
    chrome.storage.local.get(["focal_session"], (data) => {
      sendToFrame({ type: "FOCAL_SESSION", payload: data.focal_session ?? null });
    });
    return;
  }

  if (msg.type === "FOCAL_GET_SESSION") {
    chrome.storage.local.get(["focal_session"], (data) => {
      sendToFrame({ type: "FOCAL_SESSION", payload: data.focal_session ?? null });
    });
    return;
  }

  if (msg.type === "FOCAL_SET_SESSION") {
    chrome.storage.local.set({ focal_session: msg.payload ?? null });
    return;
  }

  if (msg.type === "FOCAL_CLEAR_SESSION") {
    chrome.storage.local.remove("focal_session");
    return;
  }

  if (msg.type === "FOCAL_OPEN_LOGIN_TAB") {
    const url = typeof msg.payload === "string" ? msg.payload : msg.payload?.url;
    if (url && chrome.tabs?.create) {
      chrome.tabs.create({ url });
    }
    return;
  }

  if (msg.type === "FOCAL_UPDATE_BLOCKER") {
    const domains = Array.isArray(msg.payload?.domains) ? msg.payload.domains : [];
    const active = Boolean(msg.payload?.active);
    chrome.storage.local.set(
      {
        focal_blocker_domains: domains,
        focal_blocker_active: active,
      },
      () => {
        chrome.runtime.sendMessage({ type: "FOCAL_REFRESH_BLOCKER" });
      }
    );
  }
});
