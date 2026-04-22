import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { addDaysIso } from "@/lib/learn-dates";

export const runtime = "nodejs";

function weekStartMondayLocalFromIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

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

  let body: { weekStartDate?: string };
  try {
    body = (await req.json()) as { weekStartDate?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const weekStart = body.weekStartDate?.trim() || weekStartMondayLocalFromIso(new Date().toISOString().slice(0, 10));
  const weekEnd = addDaysIso(weekStart, 6);

  const db = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile } = await db.from("profiles").select("learn_gemini_api_key").eq("id", userId).maybeSingle();
  const apiKey =
    (profile as { learn_gemini_api_key?: string | null } | null)?.learn_gemini_api_key?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Add GEMINI_API_KEY in env or your API key under Settings → Learn." }, { status: 400 });
  }

  const days: string[] = [];
  for (let i = 0; i < 7; i++) days.push(addDaysIso(weekStart, i));

  const [priorities, sessions, kolbs, experimentsWeek, skillHistWeek] = await Promise.all([
    db.from("daily_priorities").select("*").eq("user_id", userId).gte("date", weekStart).lte("date", weekEnd),
    db.from("session_logs").select("*").eq("user_id", userId).gte("date", weekStart).lte("date", weekEnd),
    db.from("kolbs_entries").select("*").eq("user_id", userId).eq("week_start_date", weekStart),
    db.from("experiments").select("*").eq("user_id", userId),
    db.from("skill_level_history").select("*").eq("user_id", userId).gte("changed_at", `${weekStart}T00:00:00`).lte("changed_at", `${weekEnd}T23:59:59`),
  ]);

  const exRows = (experimentsWeek.data ?? []) as Record<string, unknown>[];
  const testingThisWeek = exRows.filter((e) => e.status === "testing");
  const exStateChanges = exRows.filter((e) => {
    const ca = e.created_at as string | undefined;
    if (!ca) return false;
    const d = ca.slice(0, 10);
    return d >= weekStart && d <= weekEnd && (e.status === "completed" || e.status === "abandoned");
  });

  if (priorities.error?.message?.includes("does not exist") || sessions.error?.message?.includes("does not exist")) {
    return NextResponse.json({ error: "Database tables missing — run migration-learn-ics.sql in Supabase." }, { status: 500 });
  }

  const snapshot = {
    weekStart,
    weekEnd,
    daily_priorities: priorities.data ?? [],
    session_logs: sessions.data ?? [],
    kolbs_entries: kolbs.data ?? [],
    experiments_testing: testingThisWeek,
    experiments_status_changes_this_week: exStateChanges,
    skill_level_history_this_week: skillHistWeek.data ?? [],
  };

  const userBlock = JSON.stringify(snapshot, null, 2);

  const system =
    "You are a learning coach trained in the iCanStudy methodology by Justin Sung. " +
    "Use exactly these section headings in your response (uppercase, on their own lines):\n" +
    "PATTERNS:\n(2-3 specific observations about their patterns)\n\n" +
    "EXPERIMENT CHECK:\nFor each active experiment the student is testing, one sentence on whether this week's data suggests it is working. If no experiments are active, write: (none)\n\n" +
    "LEVER:\n(the single most important lever to pull next week)\n\n" +
    "QUESTION:\n(one question for them to reflect on)\n\n" +
    "Be direct, specific, and brief. No fluff. Reference their actual data.";

  const prompt = `Student week data (JSON):\n${userBlock}\n\nFill every section.`;

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
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
    geminiJson.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("\n") ??
    "No text returned from Gemini.";

  const row = {
    user_id: userId,
    week_start_date: weekStart,
    gemini_response: text,
    raw_data_snapshot: snapshot as unknown as Record<string, unknown>,
  };

  const { error: saveErr } = await db.from("weekly_summaries").upsert(row, { onConflict: "user_id,week_start_date" });
  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
