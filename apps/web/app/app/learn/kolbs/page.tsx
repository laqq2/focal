"use client";

import { LearnAuthShell } from "@/components/learn/LearnAuthShell";
import { KolbsLoopPage } from "@/components/learn/kolbs/KolbsLoopPage";

export default function LearnKolbsRoutePage() {
  return (
    <LearnAuthShell>
      {({ supabase, userId }) => (
        <div className="focal-learn-narrow" style={{ padding: "0 0.25rem" }}>
          <KolbsLoopPage supabase={supabase} userId={userId} onSyncError={() => {}} />
        </div>
      )}
    </LearnAuthShell>
  );
}
