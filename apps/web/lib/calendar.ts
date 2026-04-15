export interface CalendarEventItem {
  id: string;
  title: string;
  start: Date;
  end: Date;
  calendarId: string;
  color?: string | null;
}

interface GoogleEvent {
  id: string;
  summary?: string;
  colorId?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

function parseEventDate(value?: { dateTime?: string; date?: string }): Date | null {
  if (!value) return null;
  const raw = value.dateTime ?? value.date;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function fetchTodayEvents(accessToken: string): Promise<CalendarEventItem[]> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Calendar request failed");
  }
  const json = (await res.json()) as { items?: GoogleEvent[] };
  const items = json.items ?? [];
  const mapped: CalendarEventItem[] = [];
  for (const ev of items) {
    const s = parseEventDate(ev.start);
    const e = parseEventDate(ev.end) ?? s;
    if (!s) continue;
    mapped.push({
      id: ev.id,
      title: ev.summary ?? "(No title)",
      start: s,
      end: e ?? s,
      calendarId: "primary",
      color: ev.colorId ?? null,
    });
  }
  return mapped.sort((a, b) => a.start.getTime() - b.start.getTime());
}
