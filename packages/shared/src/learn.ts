export type PriorityStatus = "not_started" | "in_progress" | "done";

export type EisenhowerQuadrant = "IU" | "INU" | "NIU" | "NINU";

export type EodResult = "yes" | "partial" | "no";

export type SessionType = "theory" | "practice";

export type CompetencyLevel = "UI" | "CI" | "CC" | "UC";

export type ExperimentStatus = "pending" | "testing" | "completed" | "abandoned";

export type GoalStatus = "active" | "paused" | "achieved";

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
  priority_1_goal_id?: string | null;
  priority_2_goal_id?: string | null;
  experiment_notes?: string | null;
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
  goal_id?: string | null;
  experiment_id?: string | null;
  created_at?: string;
}

/** Full Kolb row including legacy + v2 fields */
export interface KolbsEntryRow {
  id: string;
  user_id: string;
  week_start_date: string;
  experience: string;
  observations: string;
  learnings: string;
  experiment: string;
  ics_technique_tag: string | null;
  skill_id?: string | null;
  previous_kolbs_id?: string | null;
  spawned_kolbs_id?: string | null;
  is_reflecting_on_experiment?: boolean | null;
  competency_level_at_time?: string | null;
  event_sequence?: string | null;
  emotions?: string | null;
  difficult_aspects?: string | null;
  easy_aspects?: string | null;
  response_to_challenges?: string | null;
  triggers?: string | null;
  why_i_acted?: string | null;
  habits_and_beliefs?: string | null;
  appears_in_other_areas?: boolean | null;
  other_areas_detail?: string | null;
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

export interface GoalAreaRow {
  id: string;
  user_id: string;
  name: string;
  color_tag: string;
  is_active: boolean;
  created_at?: string;
}

export interface GoalRow {
  id: string;
  user_id: string;
  goal_area_id: string | null;
  title: string;
  timeframe_months: number | null;
  why: string | null;
  success_metric: string | null;
  status: GoalStatus | string;
  created_at?: string;
}

export interface GoalReviewRow {
  id: string;
  user_id: string;
  goal_id: string;
  review_month: string;
  progress_rating: number | null;
  what_worked: string | null;
  what_didnt: string | null;
  adjustment: string | null;
  gemini_summary: string | null;
  created_at?: string;
}

export interface SkillRow {
  id: string;
  user_id: string;
  name: string;
  ics_category: string | null;
  current_level: string;
  created_at?: string;
}

export interface SkillLevelHistoryRow {
  id: string;
  user_id: string;
  skill_id: string;
  level: string;
  changed_at: string;
  note: string | null;
}

export interface GoalSkillRow {
  goal_id: string;
  skill_id: string;
  expected_level: string | null;
}

export interface ExperimentRow {
  id: string;
  user_id: string;
  kolbs_id: string;
  skill_id: string | null;
  description: string;
  status: ExperimentStatus | string;
  outcome: string | null;
  spawned_kolbs_id: string | null;
  created_at?: string;
}

export const EISENHOWER_LABELS: Record<EisenhowerQuadrant, string> = {
  IU: "Important · Urgent",
  INU: "Important · Not urgent",
  NIU: "Not important · Urgent",
  NINU: "Not important · Not urgent",
};

export const COMPETENCY_TOOLTIPS: Record<CompetencyLevel, string> = {
  UI: "You don't know what you don't know — open-mindedness needed",
  CI: "You can spot your mistakes — now find patterns",
  CC: "You can do it right — building consistency",
  UC: "Second nature — time to refine and personalise",
};

export const MARGINAL_GAIN_BY_LEVEL: Record<CompetencyLevel, string> = {
  UI: "Open-mindedness, less overconfidence, more experimentation, recognise issue patterns, increase theoretical knowledge",
  CI: "Recognise mistakes consistently, find ways you do it wrong",
  CC: "Require less effort, increase consistency",
  UC: "Refine and personalise",
};
