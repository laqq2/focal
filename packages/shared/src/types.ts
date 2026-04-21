export type ClockFormat = "12hr" | "24hr";

export type QuoteStyle = "motivational" | "stoic" | "theology" | "custom";

export type ThemeMode = "photo" | "solid";

export interface ProfileRow {
  id: string;
  name: string | null;
  /** Custom line; use `{name}` and `{greeting}`. Null/blank → default time greeting + name. */
  greeting_template: string | null;
  clock_format: ClockFormat;
  focus_duration: number;
  break_duration: number;
  quote_style: QuoteStyle;
  custom_quotes: string | null;
  show_memento_widget: boolean;
  theme: ThemeMode;
  /** Optional; used server-side for LEARN weekly AI summaries if set. */
  learn_gemini_api_key?: string | null;
  updated_at?: string;
}

export interface TaskListRow {
  id: string;
  user_id: string;
  title: string;
  sort_index: number;
  updated_at?: string;
}

export interface TaskRow {
  id: string;
  user_id: string;
  list_id: string;
  title: string;
  done: boolean;
  /** 1 = starred / high priority (sorted above normal within open tasks). */
  priority: number;
  sort_index: number;
  updated_at?: string;
}

export interface DailyGoalRow {
  id: string;
  user_id: string;
  date: string;
  goal: string | null;
  updated_at?: string;
}

export interface FocusSessionRow {
  id: string;
  user_id: string;
  date: string;
  minutes_focused: number;
  updated_at?: string;
}

export interface FocusDistraction {
  note: string;
  at: string;
}

export interface FocusLogRow {
  id: string;
  user_id: string;
  started_at: string | null;
  ended_at: string;
  planned_minutes: number;
  actual_minutes: number;
  intent: string | null;
  distractions: FocusDistraction[] | null;
  created_at?: string;
}

export interface BlockedSiteRow {
  id: string;
  user_id: string;
  domain: string;
  created_at?: string;
}

export interface MementoEntryRow {
  id: string;
  user_id: string;
  label: string;
  /** Kept for backwards compatibility; derived from birth_date when present */
  birth_year: number;
  /** ISO date string yyyy-mm-dd when set */
  birth_date?: string | null;
  life_expectancy: number;
  updated_at?: string;
}

export type BridgeMessageType =
  | "FOCAL_CHILD_READY"
  | "FOCAL_GET_SESSION"
  | "FOCAL_SESSION"
  | "FOCAL_SET_SESSION"
  | "FOCAL_CLEAR_SESSION"
  | "FOCAL_OPEN_LOGIN_TAB"
  | "FOCAL_UPDATE_BLOCKER"
  | "FOCAL_BLOCKER_STATE"
  | "FOCAL_PING";

export interface BridgeMessage<T = unknown> {
  type: BridgeMessageType;
  payload?: T;
}

export interface SessionPayload {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

export interface BlockerPayload {
  domains: string[];
  active: boolean;
}
