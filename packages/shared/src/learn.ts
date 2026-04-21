export type PriorityStatus = "not_started" | "in_progress" | "done";

export type EisenhowerQuadrant = "IU" | "INU" | "NIU" | "NINU";

export type EodResult = "yes" | "partial" | "no";

export type SessionType = "theory" | "practice";

export type IcsTechniqueTag =
  | "Time management"
  | "Procrastination"
  | "Note-taking"
  | "Revision"
  | "Focus"
  | "Mindset"
  | "Other";

export interface DailyPrioritiesRow {
  id?: string;
  user_id: string;
  date: string;
  priority_1_title: string | null;
  priority_1_mvg: string | null;
  priority_1_quadrant: EisenhowerQuadrant | string | null;
  priority_1_status: PriorityStatus | string;
  priority_2_title: string | null;
  priority_2_mvg: string | null;
  priority_2_quadrant: EisenhowerQuadrant | string | null;
  priority_2_status: PriorityStatus | string;
  disruption_mode_activated: boolean;
  important_not_urgent_task: string | null;
  important_not_urgent_scheduled: boolean;
  off_track_reason: string | null;
  eod_p1_result: EodResult | string | null;
  eod_p2_result: EodResult | string | null;
  eod_completed_at: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SessionLogRow {
  id: string;
  user_id: string;
  date: string;
  subject: string;
  duration_mins: number;
  focus_quality: number;
  session_goal: string | null;
  goal_hit: EodResult | string | null;
  distractions: string | null;
  session_type: SessionType | string;
  created_at?: string;
}

export interface KolbsEntryRow {
  id: string;
  user_id: string;
  week_start_date: string;
  experience: string;
  observations: string;
  learnings: string;
  experiment: string;
  ics_technique_tag: string | null;
  created_at?: string;
}

export interface WeeklySummaryRow {
  id: string;
  user_id: string;
  week_start_date: string;
  gemini_response: string;
  raw_data_snapshot: Record<string, unknown> | null;
  created_at?: string;
}

export const EISENHOWER_LABELS: Record<EisenhowerQuadrant, string> = {
  IU: "Important · Urgent",
  INU: "Important · Not urgent",
  NIU: "Not important · Urgent",
  NINU: "Not important · Not urgent",
};
