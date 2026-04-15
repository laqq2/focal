export const BLOCKER_PRESETS: Record<string, string[]> = {
  "Social Media": [
    "twitter.com",
    "x.com",
    "instagram.com",
    "tiktok.com",
    "facebook.com",
    "reddit.com",
  ],
  News: ["bbc.com", "cnn.com", "nytimes.com", "theguardian.com", "reuters.com"],
  YouTube: ["youtube.com", "youtu.be"],
};

export const CACHE_KEYS = {
  profile: "focal_cache_profile",
  goals: "focal_cache_goals",
  focus: "focal_cache_focus",
  focusLogs: "focal_cache_focus_logs",
  blocked: "focal_cache_blocked",
  memento: "focal_cache_memento",
  taskLists: "focal_cache_task_lists",
  tasks: "focal_cache_tasks",
  pendingWrites: "focal_pending_writes",
} as const;
