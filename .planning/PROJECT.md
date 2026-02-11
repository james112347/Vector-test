# Vector

## What This Is

Vector is a PWA (Progressive Web App) that calculates, tracks, and predicts a user's energy levels across three dimensions -- physical, mental, and emotional -- based on their lifestyle profile, daily inputs (sleep, hydration, food, phone usage, work shifts, fatigue type), and ongoing behavioral patterns. The app uses AI (Groq API) to analyze data, generate personalized advice, alert users when something is off, and improve predictions over time by learning the user's routine. Users set goals (daily, weekly, short/long-term) and the app balances priorities, suggesting what to push and what to recover from. Design is minimal, professional, and uses neuroscience-based color choices with dark mode support.

## Core Value

A single place where users see their real energy state (physical + mental + emotional), understand why they feel the way they do, get AI-driven predictions of what happens if nothing changes, and receive actionable advice to optimize their day -- all improving over time as the app learns their routine.

## Requirements

### Validated

(None yet -- ship to validate)

### Active

- [ ] Password-protected authentication with T&C acceptance
- [ ] Installable PWA (add to home screen, offline shell)
- [ ] Onboarding questionnaire (age, weight, work habits, student/worker, schedule, aspirations, work type, vices, segnalazioni)
- [ ] Daily logging: sleep (duration + quality), phone usage (screenshots), work shift, fatigue type, hydration, food
- [ ] Energy calculation engine (total, physical, mental, emotional) with AI analysis
- [ ] User profile with energy scores, predictions, and personalized advice
- [ ] Goals system (daily/weekly/short-term/long-term with importance levels)
- [ ] Smart balancing: which goals to push, productivity vs recovery suggestions
- [ ] AI integration (Groq API) for analysis, predictions, and suggestions
- [ ] Smart notifications with feedback requests to update predictions
- [ ] App learns user routine and improves predictions over time
- [ ] Dark mode toggle
- [ ] Neuroscience-based minimal professional design
- [ ] Long-term data persistence and frequency tracking
- [ ] Organized data sharing with app owner
- [ ] Time-aware (considers current time of day in calculations)

### Out of Scope

- Native mobile apps (iOS/Android) -- PWA-first
- OAuth / social login -- password auth for v1
- Social features -- single-user tracker
- Payment / subscription -- free for v1
- Multi-language i18n -- single language first

## Context

- The app must work long-term: data accumulated over weeks/months is the core value
- User behavior frequencies must be tracked and visible
- The owner needs to see all collected data in an organized/aggregated way
- Energy factors: work habits, student/worker status, age, weight, work schedules, aspirations, work type, vices, segnalazioni, sleep, hydration, food, phone usage, fatigue type
- Three energy dimensions: physical, mental, emotional -- plus a total score
- Special user-reported flags ("segnalazioni") can significantly influence energy calculations
- AI (Groq) analyzes patterns, generates advice, makes predictions, and improves over time
- The app should be informative: help users understand their stress, fatigue type, and energy state
- Predictions show what happens if the user doesn't change habits
- Goals have priority levels and the app suggests which to focus on
- Notifications are logical and request targeted feedback to refine predictions
- Design: minimal, functional, organized, professional, neuroscience-informed colors
- Time-of-day awareness affects energy calculations and suggestions

## Constraints

- **Platform**: PWA -- installable on home screen, offline shell, mobile-first
- **Auth**: Password-based, T&C required before registration
- **AI**: Groq API (key in .env, NEVER committed)
- **Design**: Minimal, professional, neuroscience-based colors, dark mode
- **Persistence**: Data must survive app restarts, stored long-term
- **Privacy**: User data shared only with app owner via admin panel
- **Notifications**: Must be logical, not spammy, with feedback-request mechanism

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Bootstrap with BMAD + GSD + Ralph | Structured AI-driven development workflow | Active |
| PWA over native app | Installable, cross-platform, no app store needed | Active |
| Password auth (not OAuth) | Simpler for v1, direct control | Active |
| Three energy dimensions | Physical + Mental + Emotional = Total | Active |
| Groq API for AI | Fast inference, user-provided API key | Active |
| Neuroscience-based design | Colors affect mood/productivity, backed by research | Active |
| Learning system | App improves predictions by studying user routine | Active |

---
*Last updated: 2026-02-11 -- full product vision defined*
