# Focal Analytics Specification

## Goal
Define the minimum analytics taxonomy required to measure activation, retention, and monetization with clean event naming.

## Identity
- `user_id` (Supabase auth id)
- `session_id` (frontend-generated UUID per browser session)
- `device_type` (`web`, `extension`)
- `plan` (`free`, `trial`, `pro`)

## Core Events
### Acquisition and Activation
- `landing_viewed`
- `signup_started`
- `signup_completed`
- `onboarding_started`
- `onboarding_completed`
- `first_focus_started`
- `first_focus_completed`

### Focus and Blocker
- `focus_session_started`
- `focus_session_completed`
- `focus_session_abandoned`
- `blocker_enabled`
- `blocker_disabled`
- `blocked_site_added`
- `blocked_site_attempted`

### Learn and Reflection
- `daily_priority_set`
- `weekly_review_started`
- `weekly_review_completed`
- `next_week_plan_created`

### Monetization
- `paywall_viewed`
- `trial_started`
- `checkout_started`
- `subscription_started`
- `subscription_renewed`
- `subscription_canceled`
- `payment_failed`

## Event Property Standards
- `timestamp_utc` (ISO)
- `source_surface` (`landing`, `dashboard`, `learn_panel`, `settings`, `post_session_modal`)
- `experiment_variant` (nullable)
- `country_code` (nullable)

## KPI Definitions
- Activation Rate = users with `first_focus_completed` within 24h / new signups
- Day-7 Retention = users active on day 7 / new signups
- Trial Start Rate = users with `trial_started` / eligible free active users
- Trial to Paid = users with `subscription_started` / users with `trial_started`
- Churn (monthly) = canceled paid users / paid users at period start

## Data Quality Rules
- Never rename events after production without explicit versioning.
- Avoid sending PII in event properties.
- Add `event_version` when schema changes.
- Validate event payloads in development logs.

## Suggested Storage
- Option A: PostHog (fastest startup)
- Option B: Supabase table `analytics_events` + scheduled aggregations

## Dashboard Views (minimum)
- Activation funnel
- Retention cohorts
- Monetization funnel
- Blocker effectiveness (attempts blocked per active user)
- Weekly review completion trend
