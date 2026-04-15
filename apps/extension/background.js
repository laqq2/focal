/* global chrome */

async function clearDynamicRules() {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const ids = existing.map((r) => r.id);
  if (ids.length) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ids });
  }
}

async function applyBlockerRules() {
  const data = await chrome.storage.local.get(["focal_blocker_domains", "focal_blocker_active"]);
  const active = Boolean(data.focal_blocker_active);
  const domains = Array.isArray(data.focal_blocker_domains) ? data.focal_blocker_domains : [];
  await clearDynamicRules();
  if (!active || !domains.length) return;

  const addRules = [];
  let id = 1;
  for (const domain of domains) {
    const clean = String(domain).toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
    if (!clean) continue;
    const variants = [`*://${clean}/*`, `*://*.${clean}/*`];
    for (const urlFilter of variants) {
      addRules.push({
        id,
        priority: 1,
        action: {
          type: "redirect",
          redirect: { extensionPath: "/blocked.html" },
        },
        condition: {
          urlFilter,
          resourceTypes: ["main_frame"],
        },
      });
      id += 1;
    }
  }

  if (addRules.length) {
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void applyBlockerRules();
});

chrome.runtime.onStartup.addListener(() => {
  void applyBlockerRules();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.focal_blocker_domains || changes.focal_blocker_active) {
    void applyBlockerRules();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "FOCAL_REFRESH_BLOCKER") {
    void applyBlockerRules().then(() => sendResponse({ ok: true }));
    return true;
  }
  return undefined;
});

// Note: redirect extensionPath serves blocked.html; query params are not preserved across all
// Chrome versions for extension redirects — blocked page reads session blocked host via
// declarativeNetRequest.getMatchedRules in page script (not implemented). For simplicity,
// blocked.html reads host from document.referrer or shows a generic message.
