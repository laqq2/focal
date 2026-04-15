function hostnameFromReferrer() {
  try {
    if (document.referrer) {
      return new URL(document.referrer).hostname;
    }
  } catch {
    /* ignore */
  }
  return null;
}

const host = hostnameFromReferrer();
const title = document.getElementById("title");
const hostEl = document.getElementById("host");
const back = document.getElementById("back");

if (host) {
  if (title) title.textContent = `🚫 ${host} is blocked`;
  if (hostEl) hostEl.textContent = host;
} else if (hostEl) {
  hostEl.textContent = "Focal is helping you stay on track.";
}

if (back) {
  back.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  });
}
