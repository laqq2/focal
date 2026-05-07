# Focal Monetization and Pricing

## Pricing Recommendation
- Pro Monthly: USD 8
- Pro Annual: USD 69
- Founding Offer: USD 49 annual for first 100 paying users (grandfathered)

## Packaging
### Free (permanent)
- Focus timer and basic session logging
- Basic ambient sounds
- Daily priorities and lightweight weekly summary
- Basic blocker list management

### Pro
- Advanced reflection analytics (weekly/monthly trend insights)
- Enhanced blocker controls (presets, scheduling windows, usage insights)
- Expanded history and export features
- Premium sound packs and personalization options
- Priority support and early feature access

## Monetization Principles
- Keep core behavior loop free (plan -> focus -> reflect).
- Gate acceleration and depth, not basic functionality.
- Trigger upgrades after value, not before value.

## Paywall Strategy
### Trigger moments
- After 5 completed focus sessions.
- After second weekly reflection completion.
- After user attempts a Pro-only insight panel.

### Surfaces
- Inline upgrade card in Learn panel.
- Post-session modal (low-friction, skippable).
- Settings billing tab.

## Trial and Offers
- 14-day Pro trial.
- One "save offer" on cancel (20% off annual).
- Win-back email at day 14 post-cancel with annual offer.

## Billing Operations Checklist
- Stripe products: `focal_pro_monthly`, `focal_pro_annual`.
- Webhooks: subscription created/updated/canceled, invoice payment success/failed.
- Access control: enforce `plan = free | pro`.
- Dunning: failed payment reminders + grace period.
- Self-serve billing portal enabled.

## Guardrails
- No dark patterns (no forced annual default without clear choice).
- No infinite countdown fake scarcity.
- Clear cancellation flow from settings.
