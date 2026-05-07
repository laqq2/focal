# Focal Product Requirements Document (PRD)

## 1) Product Summary

Focal is a calm-focus workspace that combines a session timer, distraction blocking, daily priorities, and weekly reflection in one browser-native flow.

This PRD defines the first monetization-ready release so Focal can move from early access into a sustainable product business.

## 2) Problem Statement

- Existing productivity tools reward streaks and intensity, which can increase anxiety and churn.
- Browser distraction is the biggest execution failure point for students and knowledge workers.
- Planning, execution, and reflection are split across multiple tools, reducing follow-through.

## 3) Target Users

- Students and researchers doing deep study sessions.
- Knowledge workers and creators who work primarily in browser tabs.
- ADHD users who need structure without guilt-oriented design.

## 4) Product Positioning

Focal is "the calm focus operating system for your browser":

- One place to start a deliberate session.
- One place to enforce boundaries while working.
- One place to close the loop with reflection and iteration.

## 5) Business Goals (90 days)

- Reach activation >= 45% (new users who complete first focus session in 24h).
- Reach Day-7 retention >= 30%.
- Reach paid conversion >= 5% of monthly active users.
- Reach first USD 2,000 MRR milestone.

## 6) Product Goals

- Improve first-session onboarding and completion.
- Make blocker value obvious and reliable.
- Improve weekly reflection completion.
- Add monetization mechanics without harming trust.

## 7) Scope

### In scope

- Freemium packaging and Pro tier.
- New user onboarding flow (guided first session).
- Paywall surfaces and trial mechanics.
- Event analytics and KPI reporting.
- Launch assets (Product Hunt + landing proof).

### Out of scope

- Team workspaces.
- Native mobile apps.
- Firefox/Safari extension parity beyond web app support.

## 8) Requirements

### A. Onboarding (P0)

- User sees a 3-step guided setup on first auth:
  1. Choose today's intention
  2. Enable blocker with one starter preset
  3. Start and complete first focus session
- Completion state stored in profile metadata.

### B. Paywall and Packaging (P0)

- Free plan remains useful forever.
- Pro unlocks:
  - advanced reflection and trend analytics
  - richer blocker controls (presets/scheduling/deeper insights)
  - premium sound packs and deeper customization
  - expanded history/export features
- Trigger paywall after user experiences value (for example, 5 completed sessions or 2 weekly reviews).

### C. Retention Loops (P0)

- Weekly review prompt (Sunday local time default).
- "Plan next week" one-click CTA after review.
- Gentle reminders with non-shaming copy.

### D. Trust and Privacy (P0)

- Clarify what data is stored, synced, and never sold.
- Clarify calendar permission scope (read-only).
- Clarify blocker behavior and when it is active.

### E. Analytics (P0)

- Track full activation -> retention -> monetization funnel.
- Track blocker usage quality and reflection completion.

## 9) User Stories

- As a new user, I can start my first session in under 2 minutes.
- As a focus user, I can enable blocking quickly and trust it works.
- As a reflective user, I can review my week and set next priorities.
- As a paying user, I can understand why Pro is worth it.

## 10) Success Metrics

- Activation rate
- D1/D7/D30 retention
- Sessions per active user per week
- Weekly review completion rate
- Trial start rate, trial->paid conversion
- Subscription churn at 30/60/90 days

## 11) Risks and Mitigation

- Risk: monetization too early hurts trust.
  - Mitigation: keep free tier strong and paywall after proven value moments.
- Risk: low retention from weak onboarding.
  - Mitigation: guided flow and "first win" completion target.
- Risk: permission/privacy hesitation.
  - Mitigation: plain-language privacy summaries and contextual permission copy.

## 12) Launch Criteria

- KPI dashboard operational.
- Onboarding and paywall instrumentation validated.
- Billing flows tested end-to-end.
- Real user testimonials replace placeholder social proof.
- Product Hunt assets and maker narrative ready.