/** Monday-based week; returns yyyy-mm-dd in local calendar. */
export function weekStartMondayLocal(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return localIsoDate(x);
}

export function localIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const x = new Date(y, m - 1, d + delta);
  return localIsoDate(x);
}

export function computeKolbStreak(weekStarts: Iterable<string>): number {
  const set = new Set(weekStarts);
  let ws = weekStartMondayLocal(new Date());
  let streak = 0;
  for (let i = 0; i < 104; i++) {
    if (set.has(ws)) {
      streak++;
      ws = addDaysIso(ws, -7);
    } else {
      break;
    }
  }
  return streak;
}

export function timeGreeting(hour: number): "morning" | "afternoon" | "evening" {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
