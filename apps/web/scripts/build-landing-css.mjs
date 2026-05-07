import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "_design-landing-source.html"), "utf8");
const m = html.match(/<style>\s*([\s\S]*?)\s*<\/style>/);
if (!m) throw new Error("no style block");
let css = m[1];
css = css.replace(/\/\* ── Tweaks overrides target ── \*\/\s*$/, "");

css = css.replace(/:root\s*\{/, ".focal-lp {");
css = css.replace(
  /html\s*\{\s*scroll-behavior:\s*smooth;\s*\}/,
  "html:has(.focal-lp) { scroll-behavior: smooth; }",
);
css = css.replace(
  /body\s*\{\s*font-family:\s*var\(--sans\);[\s\S]*?-webkit-font-smoothing:\s*antialiased;\s*\}/,
  `.focal-lp {
  font-family: var(--sans);
  background: var(--bg);
  color: var(--text);
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}`,
);
css = css.replace(
  /\*, \*::before, \*::after \{ box-sizing: border-box; margin: 0; padding: 0; \}/,
  `.focal-lp,
.focal-lp *::before,
.focal-lp *::after { box-sizing: border-box; }
.focal-lp * { margin: 0; padding: 0; }`,
);
css = css.replace(/^    a \{/m, "    .focal-lp a {");
css = css.replace(/^    button \{/m, "    .focal-lp button {");
css = css.replace(/^    img \{/m, "    .focal-lp img {");
css = css.replace(/^    section \{/m, "    .focal-lp section {");
css = css.replace(/body \{ padding-bottom: 72px; \}/, "body:has(.focal-lp) { padding-bottom: 72px; }");
css = css.replace(/url\('background\.jpg'\)/g, "url('/background.jpg')");

function prefixSelectorList(sel) {
  return sel
    .split(",")
    .map((s) => {
      s = s.trim();
      if (!s) return s;
      if (s.startsWith(".focal-lp")) return s;
      return `.focal-lp ${s}`;
    })
    .join(", ");
}

const lines = css.split("\n");
const out = [];
let inKeyframes = false;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const km = line.match(/^(\s*)(@keyframes\s+[\w-]+)\s*\{/);
  if (km) {
    inKeyframes = true;
    out.push(line);
    continue;
  }
  if (inKeyframes) {
    out.push(line);
    if (/^\s*\}\s*$/.test(line)) inKeyframes = false;
    continue;
  }

  const top = line.match(/^    (@media[^{]+)\{/);
  if (top) {
    out.push(line);
    continue;
  }

  const nested = line.match(/^      ([^@\s][^{]+)\{/);
  if (nested) {
    let sel = nested[1].trim();
    if (!sel.startsWith(".focal-lp") && !sel.startsWith("body:has")) {
      sel = prefixSelectorList(sel);
    }
    out.push(line.replace(nested[1].trim(), sel));
    continue;
  }

  const rule = line.match(/^    ([^@\s][^{]+)\{/);
  if (rule) {
    let sel = rule[1].trim();
    if (
      sel.startsWith(".focal-lp") ||
      sel.startsWith("html:has") ||
      sel.startsWith("body:has") ||
      sel.startsWith("@media") ||
      sel.startsWith("@keyframes")
    ) {
      out.push(line);
      continue;
    }
    const prefixed = prefixSelectorList(sel);
    out.push(line.replace(sel, prefixed));
    continue;
  }

  out.push(line);
}

css = out.join("\n");
css = css.replace(
  ".focal-lp .hero-bg {\n      position: absolute;\n      inset: 0;\n      background-image: url('/background.jpg');",
  ".focal-lp .hero-bg {\n      position: absolute;\n      inset: 0;\n      background-color: var(--bg);\n      background-image: url('/background.jpg');",
);
const banner = "/* Focal marketing landing — generated from _design-landing-source.html; scoped to .focal-lp */\n\n";
fs.writeFileSync(path.join(root, "app", "landing-design.css"), banner + css.trim() + "\n");
console.log("Wrote app/landing-design.css");
