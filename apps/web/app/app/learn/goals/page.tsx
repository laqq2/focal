"use client";

import { LearnAuthShell } from "@/components/learn/LearnAuthShell";
import { GoalsPage } from "@/components/learn/goals/GoalsPage";

export default function LearnGoalsRoutePage() {
  return (
    <LearnAuthShell>
      {({ supabase, userId, accessToken }) => (
        <div className="focal-learn-narrow" style={{ padding: "0 0.25rem" }}>
          <GoalsPage supabase={supabase} userId={userId} accessToken={accessToken} onSyncError={() => {}} />
        </div>
      )}
    </LearnAuthShell>
  );
}
