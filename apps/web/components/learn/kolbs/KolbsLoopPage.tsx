"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CompetencyLevel,
  ExperimentRow,
  KolbsEntryRow,
  SkillRow,
} from "@focal/shared";
import {
  COMPETENCY_TOOLTIPS,
  MARGINAL_GAIN_BY_LEVEL,
} from "@focal/shared";
import type { createSupabaseBrowser } from "@/lib/supabase-browser";
import { enqueuePending } from "@/lib/sync";
import { computeKolbStreak, weekStartMondayLocal } from "@/lib/learn-dates";

const LEVELS: CompetencyLevel[] = ["UI", "CI", "CC", "UC"];
const ICS_OPTIONS = [
  "Time management",
  "Procrastination",
  "Note-taking",
  "Revision",
  "Focus",
  "Mindset",
  "Other",
] as const;

type View = "list" | "form";

type KolbsListItem = KolbsEntryRow & {
  skill?: { name: string } | null;
  experiment_count?: number;
};

export function KolbsLoopPage({
  supabase,
  userId,
  onSyncError,
}: {
  supabase: ReturnType<typeof createSupabaseBrowser>;
  userId: string;
  onSyncError: () => void;
}) {
  const [view, setView] = useState<View>("list");
  const [loading, setLoading] = useState(true);
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [testingEx, setTestingEx] = useState<(ExperimentRow & { skill?: { name: string } | null })[]>([]);
  const [kolbsList, setKolbsList] = useState<KolbsListItem[]>([]);
  const [chainDates, setChainDates] = useState<Record<string, string>>({});
  const [exOpen, setExOpen] = useState(true);

  const [skillSearch, setSkillSearch] = useState("");
  const [createSkillOpen, setCreateSkillOpen] = useState(false);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillCat, setNewSkillCat] = useState<string>(ICS_OPTIONS[0]);
  const [newSkillLevel, setNewSkillLevel] = useState<CompetencyLevel>("UI");

  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [reflectToggle, setReflectToggle] = useState(false);
  const [parentExperimentId, setParentExperimentId] = useState<string | null>(null);
  const [competencyLevel, setCompetencyLevel] = useState<CompetencyLevel>("CI");
  const [isReflectingOnExperiment, setIsReflectingOnExperiment] = useState(false);

  const [experience, setExperience] = useState("");
  const [eventSequence, setEventSequence] = useState("");
  const [emotions, setEmotions] = useState("");
  const [difficultAspects, setDifficultAspects] = useState("");
  const [easyAspects, setEasyAspects] = useState("");
  const [responseToChallenges, setResponseToChallenges] = useState("");
  const [triggers, setTriggers] = useState("");
  const [whyIActed, setWhyIActed] = useState("");
  const [habitsAndBeliefs, setHabitsAndBeliefs] = useState("");
  const [appearsOther, setAppearsOther] = useState(false);
  const [otherAreasDetail, setOtherAreasDetail] = useState("");
  const [experiments, setExperiments] = useState<string[]>([""]);

  const [parentAbstraction, setParentAbstraction] = useState<string | null>(null);
  const [previousKolbsId, setPreviousKolbsId] = useState<string | null>(null);

  const draftKey = `kolbs_draft_${userId}`;
  const draftTimer = useRef<number | null>(null);
  const [draftBanner, setDraftBanner] = useState(false);

  const weekStart = weekStartMondayLocal(new Date());

  const streak = useMemo(() => computeKolbStreak(kolbsList.map((k) => k.week_start_date)), [kolbsList]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: sk }, { data: ex }, { data: kb }] = await Promise.all([
        supabase.from("skills").select("*").eq("user_id", userId).order("name"),
        supabase
          .from("experiments")
          .select("*, skill:skills(name)")
          .eq("user_id", userId)
          .eq("status", "testing")
          .order("created_at", { ascending: false }),
        supabase
          .from("kolbs_entries")
          .select("*, skill:skills(name)")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(60),
      ]);
      setSkills((sk as SkillRow[]) ?? []);
      setTestingEx((ex as typeof testingEx) ?? []);
      const rows = (kb as KolbsListItem[]) ?? [];
      const ids = rows.map((r) => r.id);
      let countMap: Record<string, number> = {};
      if (ids.length) {
        const { data: ec } = await supabase.from("experiments").select("kolbs_id").in("kolbs_id", ids);
        for (const row of ec ?? []) {
          const k = (row as { kolbs_id: string }).kolbs_id;
          countMap[k] = (countMap[k] ?? 0) + 1;
        }
      }
      setKolbsList(rows.map((r) => ({ ...r, experiment_count: countMap[r.id] ?? 0 })));

      const chainIds = new Set<string>();
      for (const r of rows) {
        if (r.previous_kolbs_id) chainIds.add(r.previous_kolbs_id);
        if (r.spawned_kolbs_id) chainIds.add(r.spawned_kolbs_id);
      }
      if (chainIds.size) {
        const { data: ch } = await supabase.from("kolbs_entries").select("id, created_at").in("id", [...chainIds]);
        const m: Record<string, string> = {};
        for (const c of ch ?? []) {
          const row = c as { id: string; created_at: string };
          m[row.id] = new Date(row.created_at).toLocaleDateString();
        }
        setChainDates(m);
      } else {
        setChainDates({});
      }
    } catch {
      setKolbsList([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const resetForm = () => {
    setSkillSearch("");
    setSelectedSkillId(null);
    setReflectToggle(false);
    setParentExperimentId(null);
    setCompetencyLevel("CI");
    setIsReflectingOnExperiment(false);
    setExperience("");
    setEventSequence("");
    setEmotions("");
    setDifficultAspects("");
    setEasyAspects("");
    setResponseToChallenges("");
    setTriggers("");
    setWhyIActed("");
    setHabitsAndBeliefs("");
    setAppearsOther(false);
    setOtherAreasDetail("");
    setExperiments([""]);
    setParentAbstraction(null);
    setPreviousKolbsId(null);
  };

  const openNewForm = () => {
    resetForm();
    setView("form");
  };

  const startCycleFromExperiment = (ex: ExperimentRow & { skill?: { name: string } | null }) => {
    resetForm();
    setSelectedSkillId(ex.skill_id);
    setIsReflectingOnExperiment(true);
    setReflectToggle(true);
    setParentExperimentId(ex.id);
    setPreviousKolbsId(ex.kolbs_id);
    setExperience(ex.description);
    setView("form");
    void loadParentAbstraction(ex.kolbs_id);
  };

  const loadParentAbstraction = async (kolbsId: string) => {
    const { data } = await supabase.from("kolbs_entries").select("habits_and_beliefs, learnings").eq("id", kolbsId).maybeSingle();
    if (!data) return;
    const d = data as { habits_and_beliefs?: string; learnings?: string };
    setParentAbstraction((d.habits_and_beliefs || d.learnings || "").trim() || null);
  };

  useEffect(() => {
    if (!reflectToggle || !parentExperimentId || !selectedSkillId) {
      setParentAbstraction(null);
      return;
    }
    void (async () => {
      const { data: exp } = await supabase.from("experiments").select("kolbs_id").eq("id", parentExperimentId).maybeSingle();
      const kid = (exp as { kolbs_id?: string } | null)?.kolbs_id;
      if (kid) void loadParentAbstraction(kid);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadParentAbstraction stable enough for this UI
  }, [reflectToggle, parentExperimentId, selectedSkillId, supabase]);

  const filteredSkills = useMemo(() => {
    const q = skillSearch.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter((s) => s.name.toLowerCase().includes(q));
  }, [skills, skillSearch]);

  const experimentsForSkill = useMemo(() => {
    if (!selectedSkillId) return [];
    return testingEx.filter((e) => e.skill_id === selectedSkillId);
  }, [testingEx, selectedSkillId]);

  const persistDraft = useCallback(() => {
    try {
      const payload = {
        selectedSkillId,
        reflectToggle,
        parentExperimentId,
        competencyLevel,
        isReflectingOnExperiment,
        experience,
        eventSequence,
        emotions,
        difficultAspects,
        easyAspects,
        responseToChallenges,
        triggers,
        whyIActed,
        habitsAndBeliefs,
        appearsOther,
        otherAreasDetail,
        experiments,
        previousKolbsId,
      };
      localStorage.setItem(draftKey, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, [
    draftKey,
    selectedSkillId,
    reflectToggle,
    parentExperimentId,
    competencyLevel,
    isReflectingOnExperiment,
    experience,
    eventSequence,
    emotions,
    difficultAspects,
    easyAspects,
    responseToChallenges,
    triggers,
    whyIActed,
    habitsAndBeliefs,
    appearsOther,
    otherAreasDetail,
    experiments,
    previousKolbsId,
  ]);

  useEffect(() => {
    if (view !== "form") return;
    if (draftTimer.current) window.clearInterval(draftTimer.current);
    draftTimer.current = window.setInterval(() => persistDraft(), 30000);
    return () => {
      if (draftTimer.current) window.clearInterval(draftTimer.current);
    };
  }, [view, persistDraft]);

  useEffect(() => {
    if (view !== "form") return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) setDraftBanner(true);
    } catch {
      /* ignore */
    }
  }, [view, draftKey]);

  const restoreDraft = () => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const p = JSON.parse(raw) as Record<string, unknown>;
      if (typeof p.selectedSkillId === "string") setSelectedSkillId(p.selectedSkillId);
      setReflectToggle(Boolean(p.reflectToggle));
      if (typeof p.parentExperimentId === "string") setParentExperimentId(p.parentExperimentId);
      if (typeof p.competencyLevel === "string") setCompetencyLevel(p.competencyLevel as CompetencyLevel);
      setIsReflectingOnExperiment(Boolean(p.isReflectingOnExperiment));
      if (typeof p.experience === "string") setExperience(p.experience);
      if (typeof p.eventSequence === "string") setEventSequence(p.eventSequence);
      if (typeof p.emotions === "string") setEmotions(p.emotions);
      if (typeof p.difficultAspects === "string") setDifficultAspects(p.difficultAspects);
      if (typeof p.easyAspects === "string") setEasyAspects(p.easyAspects);
      if (typeof p.responseToChallenges === "string") setResponseToChallenges(p.responseToChallenges);
      if (typeof p.triggers === "string") setTriggers(p.triggers);
      if (typeof p.whyIActed === "string") setWhyIActed(p.whyIActed);
      if (typeof p.habitsAndBeliefs === "string") setHabitsAndBeliefs(p.habitsAndBeliefs);
      setAppearsOther(Boolean(p.appearsOther));
      if (typeof p.otherAreasDetail === "string") setOtherAreasDetail(p.otherAreasDetail);
      if (Array.isArray(p.experiments)) setExperiments(p.experiments.map(String));
      if (typeof p.previousKolbsId === "string") setPreviousKolbsId(p.previousKolbsId);
      setDraftBanner(false);
    } catch {
      /* ignore */
    }
  };

  const createSkill = async () => {
    if (!newSkillName.trim()) return;
    const row = {
      user_id: userId,
      name: newSkillName.trim(),
      ics_category: newSkillCat,
      current_level: newSkillLevel,
    };
    try {
      const { data, error } = await supabase.from("skills").insert(row).select("*").maybeSingle();
      if (error) throw error;
      if (data) {
        setSkills((s) => [...s, data as SkillRow].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedSkillId((data as SkillRow).id);
        setCreateSkillOpen(false);
        setNewSkillName("");
      }
    } catch {
      enqueuePending({ id: crypto.randomUUID(), table: "skills", op: "insert", payload: row, at: Date.now() });
      onSyncError();
    }
  };

  const saveKolb = async () => {
    if (!selectedSkillId || !experience.trim()) return;
    const expRows = experiments.map((e) => e.trim()).filter(Boolean).slice(0, 3);
    if (expRows.length === 0) return;

    const kolbPayload = {
      user_id: userId,
      week_start_date: weekStart,
      experience: experience.trim(),
      skill_id: selectedSkillId,
      is_reflecting_on_experiment: isReflectingOnExperiment,
      competency_level_at_time: competencyLevel,
      previous_kolbs_id: reflectToggle && previousKolbsId ? previousKolbsId : null,
      event_sequence: eventSequence.trim(),
      emotions: emotions.trim(),
      difficult_aspects: difficultAspects.trim(),
      easy_aspects: easyAspects.trim(),
      response_to_challenges: responseToChallenges.trim(),
      triggers: triggers.trim(),
      why_i_acted: whyIActed.trim(),
      habits_and_beliefs: habitsAndBeliefs.trim(),
      appears_in_other_areas: appearsOther,
      other_areas_detail: otherAreasDetail.trim() || null,
      observations: eventSequence.trim(),
      learnings: habitsAndBeliefs.trim(),
      experiment: expRows.join("\n---\n"),
      ics_technique_tag: skills.find((s) => s.id === selectedSkillId)?.ics_category ?? null,
    };

    try {
      const { data: kRow, error: ke } = await supabase.from("kolbs_entries").insert(kolbPayload).select("*").maybeSingle();
      if (ke) throw ke;
      const newKolb = kRow as KolbsEntryRow;

      const exIns = expRows.map((desc) => ({
        user_id: userId,
        kolbs_id: newKolb.id,
        skill_id: selectedSkillId,
        description: desc,
        status: "pending" as const,
      }));
      const { data: exData, error: ee } = await supabase.from("experiments").insert(exIns).select("*");
      if (ee) throw ee;

      if (parentExperimentId && reflectToggle) {
        await supabase
          .from("experiments")
          .update({ spawned_kolbs_id: newKolb.id })
          .eq("id", parentExperimentId)
          .eq("user_id", userId);
        const pk = previousKolbsId;
        if (pk) {
          await supabase.from("kolbs_entries").update({ spawned_kolbs_id: newKolb.id }).eq("id", pk).eq("user_id", userId);
        }
      }

      const skill = skills.find((s) => s.id === selectedSkillId);
      const levelChanged = window.confirm(
        `Has your competency in "${skill?.name ?? "this skill"}" changed from this reflection?`
      );
      if (levelChanged) {
        const next = window.prompt("Enter new level: UI, CI, CC, or UC", competencyLevel);
        if (next && ["UI", "CI", "CC", "UC"].includes(next.toUpperCase())) {
          const nl = next.toUpperCase() as CompetencyLevel;
          await supabase.from("skill_level_history").insert({
            user_id: userId,
            skill_id: selectedSkillId,
            level: nl,
            note: "Kolb's reflection",
          });
          await supabase.from("skills").update({ current_level: nl }).eq("id", selectedSkillId).eq("user_id", userId);
        }
      }

      for (const ex of exData ?? []) {
        const start = window.confirm(`Start testing now?\n\n"${(ex as ExperimentRow).description.slice(0, 120)}..."`);
        if (start) {
          await supabase
            .from("experiments")
            .update({ status: "testing" })
            .eq("id", (ex as ExperimentRow).id)
            .eq("user_id", userId);
        }
      }

      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      resetForm();
      setView("list");
      void loadAll();
    } catch {
      enqueuePending({
        id: crypto.randomUUID(),
        table: "kolbs_entries",
        op: "insert",
        payload: kolbPayload,
        at: Date.now(),
      });
      onSyncError();
    }
  };

  const updateExperimentStatus = async (id: string, status: ExperimentRow["status"]) => {
    try {
      await supabase.from("experiments").update({ status }).eq("id", id).eq("user_id", userId);
      void loadAll();
    } catch {
      onSyncError();
    }
  };

  const marginal = MARGINAL_GAIN_BY_LEVEL[competencyLevel];

  if (loading && view === "list") {
    return (
      <div className="focal-kolbs-list focal-learn-narrow focal-kolbs-list--loading">
        <div className="focal-kolbs-skeleton-line" style={{ width: "55%" }} />
        <div className="focal-kolbs-skeleton-line" style={{ width: "35%" }} />
        <div className="focal-kolbs-skeleton-block" />
        <div className="focal-kolbs-skeleton-block focal-kolbs-skeleton-block--short" />
      </div>
    );
  }

  if (view === "form") {
    return (
      <div className="focal-kolbs-form-root focal-learn-narrow">
        {draftBanner ? (
          <div className="focal-learn-draft-banner focal-kolbs-draft-banner">
            <span className="focal-kolbs-draft-banner__text">Restore saved draft?</span>
            <button type="button" className="focal-btn focal-kolbs-draft-banner__btn" onClick={restoreDraft}>
              Restore
            </button>
            <button type="button" className="focal-learn-text-btn" onClick={() => setDraftBanner(false)}>
              Dismiss
            </button>
          </div>
        ) : null}
        <button type="button" className="focal-kolbs-back" onClick={() => { resetForm(); setView("list"); }}>
          <span className="focal-kolbs-back__arrow" aria-hidden>
            ←
          </span>
          Back to list
        </button>

        <header className="focal-kolbs-form-hero">
          <p className="focal-kolbs-form-kicker">Reflective practice</p>
          <h2 className="focal-kolbs-form-hero-title">Kolb&apos;s Loop</h2>
          <p className="focal-kolbs-form-hero-sub">Concrete experience → reflection → abstraction → experiment.</p>
        </header>

        <div className="focal-kolbs-form">
          <section className="focal-learn-section focal-kolbs-stage focal-kolbs-stage--setup">
            <div className="focal-kolbs-stage-head">
              <span className="focal-kolbs-stage-num" aria-hidden>
                ◆
              </span>
              <div>
                <p className="focal-kolbs-eyebrow">Setup</p>
                <h3 className="focal-kolbs-stage-title">Ground the reflection</h3>
              </div>
            </div>

            <div className="focal-kolbs-subblock">
              <p className="focal-kolbs-eyebrow focal-kolbs-eyebrow--gold">The track</p>
              <label className="focal-learn-field">
                Which skill is this about?
                <input
                  className="focal-input focal-learn-input focal-kolbs-input"
                  value={skillSearch}
                  onChange={(e) => setSkillSearch(e.target.value)}
                  placeholder="Search or select a related skill…"
                />
              </label>
              <div className="focal-kolbs-skill-pick">
                {filteredSkills.slice(0, 8).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`focal-learn-chip focal-kolbs-chip ${selectedSkillId === s.id ? "active" : ""}`}
                    onClick={() => setSelectedSkillId(s.id)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              <button type="button" className="focal-kolbs-inline-action" onClick={() => setCreateSkillOpen((o) => !o)}>
                {createSkillOpen ? "Cancel create" : "+ Create skill"}
              </button>
              {createSkillOpen ? (
                <div className="focal-kolbs-create-skill">
                  <input className="focal-input focal-kolbs-input" placeholder="Name" value={newSkillName} onChange={(e) => setNewSkillName(e.target.value)} />
                  <select className="focal-learn-select focal-kolbs-select" value={newSkillCat} onChange={(e) => setNewSkillCat(e.target.value)}>
                    {ICS_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <div className="focal-learn-toggle focal-kolbs-level-toggle">
                    {LEVELS.map((l) => (
                      <button key={l} type="button" className={newSkillLevel === l ? "active" : ""} onClick={() => setNewSkillLevel(l)}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="focal-btn primary" onClick={() => void createSkill()}>
                    Add skill
                  </button>
                </div>
              ) : null}
            </div>

            <label className="focal-learn-check focal-kolbs-check">
              <input
                type="checkbox"
                checked={reflectToggle}
                onChange={(e) => {
                  setReflectToggle(e.target.checked);
                  setIsReflectingOnExperiment(e.target.checked);
                  if (!e.target.checked) {
                    setParentExperimentId(null);
                    setPreviousKolbsId(null);
                    setParentAbstraction(null);
                  }
                }}
              />
              <span>Is this reflecting on a previous experiment?</span>
            </label>
            {reflectToggle && selectedSkillId ? (
              <>
                <label className="focal-learn-field">
                  Experiment
                  <select
                    className="focal-learn-select focal-kolbs-select"
                    value={parentExperimentId ?? ""}
                    onChange={(e) => {
                      const id = e.target.value || null;
                      setParentExperimentId(id);
                      const ex = testingEx.find((x) => x.id === id);
                      if (ex) {
                        setExperience(ex.description);
                        setPreviousKolbsId(ex.kolbs_id);
                        void loadParentAbstraction(ex.kolbs_id);
                      }
                    }}
                  >
                    <option value="">—</option>
                    {experimentsForSkill.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.description.slice(0, 60)}…
                      </option>
                    ))}
                  </select>
                </label>
                {parentAbstraction ? (
                  <details className="focal-kolbs-ref-card">
                    <summary>What you concluded last time</summary>
                    <p>{parentAbstraction}</p>
                  </details>
                ) : null}
              </>
            ) : null}

            <div className="focal-kolbs-subblock">
              <p className="focal-kolbs-eyebrow focal-kolbs-eyebrow--gold">The baseline</p>
              <div className="focal-learn-field">
                <span className="focal-kolbs-field-label">Current competency level</span>
                <div className="focal-learn-toggle focal-kolbs-level-toggle" title={COMPETENCY_TOOLTIPS[competencyLevel]}>
                  {LEVELS.map((l) => (
                    <button key={l} type="button" className={competencyLevel === l ? "active" : ""} onClick={() => setCompetencyLevel(l)} title={COMPETENCY_TOOLTIPS[l]}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <p className="focal-kolbs-marginal">
                <span className="focal-kolbs-marginal-label">Marginal gain</span>
                {marginal}
              </p>
            </div>
          </section>

          <section className="focal-learn-section focal-kolbs-stage focal-kolbs-stage--1">
            <div className="focal-kolbs-stage-head">
              <span className="focal-kolbs-stage-num" aria-hidden>
                01
              </span>
              <div>
                <p className="focal-kolbs-eyebrow">Stage 1</p>
                <h3 className="focal-kolbs-stage-title">Experience</h3>
              </div>
            </div>
            <p className="focal-learn-hint focal-kolbs-prompt">What did you actually do? Keep it process-focused, specific, recent, and one sentence.</p>
            <textarea className="focal-input focal-learn-textarea focal-kolbs-textarea" rows={2} value={experience} onChange={(e) => setExperience(e.target.value)} />
          </section>

          <section className="focal-learn-section focal-kolbs-stage focal-kolbs-stage--2">
            <div className="focal-kolbs-sticky-hint">Keep asking WHY. Emotions are data.</div>
            <div className="focal-kolbs-stage-head">
              <span className="focal-kolbs-stage-num" aria-hidden>
                02
              </span>
              <div>
                <p className="focal-kolbs-eyebrow">Stage 2</p>
                <h3 className="focal-kolbs-stage-title">Reflection</h3>
              </div>
            </div>
            <label className="focal-learn-field">
              Walk through what happened, in order
              <textarea className="focal-input focal-learn-textarea focal-kolbs-textarea" value={eventSequence} onChange={(e) => setEventSequence(e.target.value)} />
            </label>
            <label className="focal-learn-field">
              How did you feel, and when exactly?
              <textarea className="focal-input focal-learn-textarea focal-kolbs-textarea" value={emotions} onChange={(e) => setEmotions(e.target.value)} />
            </label>
            <div className="focal-kolbs-split">
              <label className="focal-learn-field">
                What felt difficult?
                <textarea className="focal-input focal-learn-textarea focal-kolbs-textarea" value={difficultAspects} onChange={(e) => setDifficultAspects(e.target.value)} />
              </label>
              <label className="focal-learn-field">
                What went well?
                <textarea className="focal-input focal-learn-textarea focal-kolbs-textarea" value={easyAspects} onChange={(e) => setEasyAspects(e.target.value)} />
              </label>
            </div>
            <label className="focal-learn-field">
              How did you actually respond to difficulty? (honest, not aspirational)
              <span className="focal-learn-micro">Did you avoid, push through, retreat?</span>
              <textarea className="focal-input focal-learn-textarea focal-kolbs-textarea" value={responseToChallenges} onChange={(e) => setResponseToChallenges(e.target.value)} />
            </label>
            <label className="focal-learn-field">
              What were the triggers?
              <span className="focal-learn-micro">External cues that made you feel or act a certain way</span>
              <textarea className="focal-input focal-learn-textarea focal-kolbs-textarea" value={triggers} onChange={(e) => setTriggers(e.target.value)} />
            </label>
            <label className="focal-learn-field">
              Why did you act this way? (go deeper than what happened)
              <span className="focal-learn-micro">Metacognition — not the events, but what drove them</span>
              <textarea className="focal-input focal-learn-textarea focal-kolbs-textarea" value={whyIActed} onChange={(e) => setWhyIActed(e.target.value)} />
            </label>
          </section>

          <section className="focal-learn-section focal-kolbs-stage focal-kolbs-stage--3">
            <div className="focal-kolbs-sticky-hint">Find ROOT CAUSES not symptoms. Look for patterns across your reflection above.</div>
            <div className="focal-kolbs-stage-head">
              <span className="focal-kolbs-stage-num" aria-hidden>
                03
              </span>
              <div>
                <p className="focal-kolbs-eyebrow">Stage 3</p>
                <h3 className="focal-kolbs-stage-title">Abstraction</h3>
              </div>
            </div>
            <label className="focal-learn-field">
              What habits, beliefs, or tendencies explain your actions?
              <span className="focal-learn-micro">These become your limiting habits → scripted actions</span>
              <textarea className="focal-input focal-learn-textarea focal-kolbs-textarea" value={habitsAndBeliefs} onChange={(e) => setHabitsAndBeliefs(e.target.value)} />
            </label>
            <label className="focal-learn-check focal-kolbs-check">
              <input type="checkbox" checked={appearsOther} onChange={(e) => setAppearsOther(e.target.checked)} />
              <span>Does this pattern show up in other areas of your life?</span>
            </label>
            {appearsOther ? (
              <textarea
                className="focal-input focal-learn-textarea focal-kolbs-textarea"
                placeholder="Where else?"
                value={otherAreasDetail}
                onChange={(e) => setOtherAreasDetail(e.target.value)}
              />
            ) : null}
          </section>

          <section className="focal-learn-section focal-kolbs-stage focal-kolbs-stage--4">
            <div className="focal-kolbs-stage-head">
              <span className="focal-kolbs-stage-num" aria-hidden>
                04
              </span>
              <div>
                <p className="focal-kolbs-eyebrow">Stage 4</p>
                <h3 className="focal-kolbs-stage-title">Experiments</h3>
              </div>
            </div>
            <p className="focal-learn-hint focal-kolbs-prompt">Max 3. Specific and actionable. Imagine reading this tomorrow — would you know exactly what to do?</p>
            <div className="focal-kolbs-exp-list">
              {experiments.map((ex, i) => (
                <div key={i} className="focal-kolbs-exp-card">
                  <div className="focal-kolbs-exp-card__head">
                    <span className="focal-kolbs-exp-card__num">Experiment {String(i + 1).padStart(2, "0")}</span>
                    <button
                      type="button"
                      className="focal-kolbs-exp-remove"
                      aria-label={`Remove experiment ${i + 1}`}
                      onClick={() => setExperiments((prev) => prev.filter((_, j) => j !== i))}
                    >
                      ✕
                    </button>
                  </div>
                  <textarea
                    className="focal-input focal-learn-textarea focal-kolbs-textarea focal-kolbs-textarea--exp"
                    placeholder="Describe one concrete next step…"
                    value={ex}
                    onChange={(e) => {
                      const next = [...experiments];
                      next[i] = e.target.value;
                      setExperiments(next);
                    }}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              className="focal-kolbs-add-exp"
              disabled={experiments.length >= 3}
              onClick={() => setExperiments((e) => [...e, ""])}
            >
              <span className="focal-kolbs-add-exp__plus" aria-hidden>
                +
              </span>
              Add experiment (max 3)
            </button>
          </section>

          <div className="focal-kolbs-save-shell">
            <button
              type="button"
              className="focal-btn primary focal-kolbs-save"
              disabled={!selectedSkillId || !experience.trim() || !experiments.some((x) => x.trim())}
              onClick={() => void saveKolb()}
            >
              Save reflection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="focal-kolbs-list focal-learn-narrow">
      <header className="focal-kolbs-hero">
        <div className="focal-kolbs-hero__text">
          <p className="focal-kolbs-form-kicker">Learning loop</p>
          <h2 className="focal-kolbs-hero__title">Kolb&apos;s Loop</h2>
          <p className="focal-kolbs-hero__sub">Turn experience into your next experiment.</p>
          <div className="focal-kolbs-hero__meta">
            <span className="focal-kolbs-streak-pill">{streak} week streak</span>
          </div>
        </div>
        <button type="button" className="focal-btn primary focal-kolbs-hero__cta" onClick={openNewForm}>
          New reflection
        </button>
      </header>

      {testingEx.length ? (
        <details className="focal-kolbs-ex-widget" open={exOpen} onToggle={(e) => setExOpen((e.target as HTMLDetailsElement).open)}>
          <summary>
            <span className="focal-kolbs-ex-widget__label">Currently testing</span>
            <span className="focal-kolbs-ex-widget__hint">{testingEx.length} active</span>
          </summary>
          <ul className="focal-kolbs-ex-list">
            {testingEx.map((ex) => (
              <li key={ex.id} className="focal-kolbs-ex-item">
                <div className="focal-kolbs-ex-item__top">
                  <span className="focal-level-badge subtle">{ex.skill?.name ?? "Skill"}</span>
                </div>
                <p>{ex.description}</p>
                <div className="focal-kolbs-ex-actions">
                  <button type="button" className="focal-btn focal-kolbs-ex-btn" onClick={() => void updateExperimentStatus(ex.id, "completed")}>
                    Mark complete
                  </button>
                  <button type="button" className="focal-learn-text-btn" onClick={() => void updateExperimentStatus(ex.id, "abandoned")}>
                    Abandon
                  </button>
                  <button type="button" className="focal-learn-text-btn focal-kolbs-ex-cycle" onClick={() => startCycleFromExperiment(ex)}>
                    Start new cycle →
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <ul className="focal-kolbs-cards">
        {kolbsList.map((k) => (
          <li key={k.id}>
            <details className="focal-kolbs-card">
              <summary>
                <div className="focal-kolbs-card__row1">
                  <span className="focal-level-badge subtle focal-kolbs-card__skill">{k.skill?.name ?? "—"}</span>
                  <span className="focal-kolbs-date">{new Date(k.created_at ?? "").toLocaleDateString()}</span>
                  {k.competency_level_at_time ? (
                    <span className={`focal-level-badge lvl-${k.competency_level_at_time}`}>{k.competency_level_at_time}</span>
                  ) : null}
                  <span className="focal-kolbs-meta">{k.experiment_count ?? 0} experiments</span>
                </div>
                <span className="focal-kolbs-snippet">{k.experience}</span>
              </summary>
              <div className="focal-kolbs-chain">
                {k.previous_kolbs_id ? (
                  <span>↩ continued from {chainDates[k.previous_kolbs_id] ?? "prior"}</span>
                ) : null}
                {k.spawned_kolbs_id ? <span>→ continued {chainDates[k.spawned_kolbs_id] ?? "next"}</span> : null}
              </div>
              <div className="focal-kolbs-readonly">
                <p>
                  <strong>Experience</strong> {k.experience}
                </p>
                <p>
                  <strong>Reflection</strong> {k.event_sequence || k.observations}
                </p>
                <p>
                  <strong>Abstraction</strong> {k.habits_and_beliefs || k.learnings}
                </p>
              </div>
            </details>
          </li>
        ))}
      </ul>

      {kolbsList.length === 0 ? (
        <p className="focal-learn-empty focal-kolbs-empty">No reflections yet. Start your first Kolb&apos;s cycle.</p>
      ) : null}
    </div>
  );
}
