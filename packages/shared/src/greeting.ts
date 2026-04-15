/** Time-of-day phrase (12 / 17 boundaries, local hour). */
export function timeGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Renders the dashboard greeting line.
 * Empty template → "{timeGreeting}, {name}".
 * Placeholders: `{name}`, `{greeting}` (same as time-based phrase).
 */
export function formatGreetingLine(
  template: string | null | undefined,
  name: string,
  hour: number
): string {
  const greeting = timeGreeting(hour);
  const t = template?.trim();
  if (!t) return `${greeting}, ${name}`;
  return t.replace(/\{name\}/gi, name).replace(/\{greeting\}/gi, greeting);
}
