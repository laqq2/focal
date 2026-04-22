import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({ error: "Server missing Supabase env" }, { status: 500 });
  }

  const auth = req.headers.get("authorization");
  const token = auth?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createClient(url, anon);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = userData.user.id;

  let body: { goalId?: string; reviewMonth?: string };
  try {
    body = (await req.json()) as { goalId?: string; reviewMonth?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const goalId = body.goalId?.trim();
  const reviewMonth = body.reviewMonth?.trim();
  if (!goalId || !reviewMonth) {
    return NextResponse.json({ error: "goalId and reviewMonth required" }, { status: 400 });
  }

  const db = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile } = await db.from("profiles").select("learn_gemini_api_key").eq("id", userId).maybeSingle();
  const apiKey =
    (profile as { learn_gemini_api_key?: string | null } | null)?.learn_gemini_api_key?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Add GEMINI_API_KEY in env or Settings → Learn." }, { status: 400 });
  }

  const { data: goal, error: gErr } = await db.from("goals").select("*").eq("id", goalId).eq("user_id", userId).maybeSingle();
  if (gErr || !goal) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  const { data: gs } = await db.from("goal_skills").select("skill_id").eq("goal_id", goalId);
  const skillIds = (gs ?? []).map((r) => (r as { skill_id: string }).skill_id);

  const monthStart = reviewMonth.slice(0, 7) + "-01";
  const [y, m] = monthStart.split("-").map(Number);
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const monthEnd = `${nextY}-${String(nextM).padStart(2, "0")}-01`;

  const [sessions, kolbs, hist] = await Promise.all([
    db.from("session_logs").select("*").eq("user_id", userId).eq("goal_id", goalId).gte("date", monthStart).lt("date", monthEnd),
    skillIds.length
      ? db.from("kolbs_entries").select("*").eq("user_id", userId).in("skill_id", skillIds).gte("created_at", monthStart).lt("created_at", monthEnd)
      : Promise.resolve({ data: [] as unknown[] }),
    skillIds.length
      ? db.from("skill_level_history").select("*").eq("user_id", userId).in("skill_id", skillIds).gte("changed_at", monthStart).lt("changed_at", monthEnd)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const dataBlock = JSON.stringify(
    {
      goal,
      month: reviewMonth,
      sessions: sessions.data ?? [],
      kolbs_entries: kolbs.data ?? [],
      skill_level_history: hist.data ?? [],
    },
    null,
    2
  );

  const prompt = `You are a learning coach trained in iCanStudy methodology. A student is reviewing their month for this goal: ${JSON.stringify(goal)}. Here is their data:\n${dataBlock}\n\nRespond with exactly these three labeled sections (use these exact headings):\nHONEST ASSESSMENT:\n(2 sentences on actual progress vs metric)\n\nROOT CAUSE:\n(single underlying reason — be specific to their data)\n\nNEXT MONTH:\n(one concrete adjustment, not generic advice)\n\nBe direct. Reference actual numbers. No fluff.`;

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    }
  );

  const geminiJson = (await geminiRes.json()) as {
    error?: { message?: string };
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  if (!geminiRes.ok) {
    const msg = geminiJson.error?.message ?? geminiRes.statusText;
    return NextResponse.json({ error: `Gemini: ${msg}` }, { status: 502 });
  }
  const text =
    geminiJson.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("\n") ?? "";

  const pick = (label: string) => {
    const re = new RegExp(`${label}\\s*:?\\s*([\\s\\S]*?)(?=\\n[A-Z][A-Z_ ]+:|$)`, "i");
    const m = text.match(re);
    return m?.[1]?.trim() ?? "";
  };

  const assessment = pick("HONEST ASSESSMENT") || text.slice(0, 400);
  const rootCause = pick("ROOT CAUSE") || "";
  const nextMonth = pick("NEXT MONTH") || "";

  return NextResponse.json({ assessment, rootCause, nextMonth });
}
