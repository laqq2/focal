/** Parse Gemini weekly summary into sections for display. */
export type WeeklySections = {
  patterns: string;
  experimentCheck: string;
  lever: string;
  question: string;
  raw: string;
};

export function parseWeeklyGeminiResponse(text: string): WeeklySections {
  const raw = text.trim();
  const pIdx = raw.search(/^PATTERNS:?\s*/im);
  const expIdx = raw.search(/^EXPERIMENT CHECK:?\s*/im);
  const levIdx = raw.search(/^LEVER:?\s*/im);
  const qIdx = raw.search(/^QUESTION:?\s*/im);

  if (pIdx >= 0 && expIdx > pIdx && levIdx > expIdx) {
    const patterns = raw.slice(pIdx, expIdx).replace(/^PATTERNS:?\s*/i, "").trim();
    const experimentCheck = raw.slice(expIdx, levIdx).replace(/^EXPERIMENT CHECK:?\s*/i, "").trim();
    let lever = "";
    let question = "";
    if (qIdx > levIdx) {
      lever = raw.slice(levIdx, qIdx).replace(/^LEVER:?\s*/i, "").trim();
      question = raw.slice(qIdx).replace(/^QUESTION:?\s*/i, "").trim();
    } else {
      lever = raw.slice(levIdx).replace(/^LEVER:?\s*/i, "").trim();
    }
    return { patterns, experimentCheck, lever, question, raw };
  }

  const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return {
    patterns: lines.slice(0, Math.min(3, lines.length)).join("\n\n"),
    experimentCheck: "",
    lever: lines[lines.length - 2] ?? "",
    question: lines[lines.length - 1] ?? "",
    raw,
  };
}
