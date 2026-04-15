/* global chrome */

const frame = document.getElementById("app");

async function loadConfig() {
  const url = chrome.runtime.getURL("config.json");
  const res = await fetch(url);
  const json = await res.json();
  return json.appUrl || "http://localhost:3000/app";
}

function sendToFrame(message) {
  if (!frame?.contentWindow) return;
  frame.contentWindow.postMessage(message, "*");
}

chrome.storage.local.get(["focal_session", "focal_app_url"], async (data) => {
  const src = data.focal_app_url || (await loadConfig());
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
