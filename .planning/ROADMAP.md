# Roadmap: Vector

## Overview

Vector is an energy tracking PWA built in 8 phases, each delivering a working increment. Phase 1 establishes the installable PWA shell, password auth with admin approval, and neuroscience-based design system. Phase 2 collects the user's lifestyle profile via 4-step onboarding with circadian routine times. Phase 3 enables daily data input through 3-axis energy sliders and 12+ time-phased quick check-ins. Phase 4 implements a scientific 4-component energy model (0-100) with Groq AI for predictions and chronotype detection. Phase 5 builds the dashboard with orientation recommendations, admin stats, goals widget, and daily history. Phase 6 adds MCII/WOOP goals with AI wizard, energy budget, and chronotype scheduling. Phase 7 delivers smart notifications, habit intelligence (pattern learning + smart prompts), feedback chat, and screen time tracking. Phase 8 provides the admin panel with user management, feedback management, and hybrid AI analysis. Cross-cutting features (Sahha wearable integration, Supabase sync, Health page) were implemented throughout.

## Phases

- [x] **Phase 1: PWA Shell + Auth + Design System** - Installable app, password login with admin approval, T&C, dark mode, neuroscience HSL colors
- [x] **Phase 2: Onboarding Questionnaire** - 4-step form: personal data, occupation, habits/routine (circadian times), goals + Supabase sync
- [x] **Phase 3: Daily Logging** - 3-axis energy sliders (1-10), 12+ quick check-in types, time-phased prompts, AI tips
- [x] **Phase 4: Energy Engine + AI** - Scientific 4-component model (0-100), chronotype, 12h predictions, Groq AI, ML trends
- [x] **Phase 5: Dashboard & Visualization** - Time-aware greeting, admin stats, orientation, goals widget, daily history, insights link
- [x] **Phase 6: Goals & Smart Balancing** - WOOP framework, AI wizard (3 modes), energy budget, chronotype scheduling, streaks
- [x] **Phase 7: Notifications + Learning System** - Browser notifications, habit intelligence, feedback chat, screen time tracking
- [x] **Phase 8: Owner Data Panel** - Admin dashboard, user management, feedback management, hybrid AI analysis

## Cross-Cutting Features (implemented throughout phases)

- **Wearable Integration (Sahha)**: Health scores + biomarkers, auto-sync, Health page (1500+ lines)
- **Cross-Device Sync (Supabase)**: Profile sync, webhook data, API key management, graceful local fallback
- **Italian Localization**: All UI text in Italian
- **Screen Time Tracking**: Passive auto-tracking of app usage

## Phase Details

### Phase 1: PWA Shell + Auth + Design System
**Goal**: A working PWA installable on the home screen, with password auth (including admin approval workflow), T&C acceptance, dark mode toggle, and the neuroscience-based design system that all future phases build on.
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01..07, PWA-01..03, DESIGN-01..05
**Success Criteria** (what must be TRUE):
  1. User can install the app on their phone's home screen
  2. App shows a login wall -- no content visible without authentication
  3. New user must accept T&C before registration completes
  4. User session persists after closing and reopening the app (30-day expiration)
  5. App shell loads even when offline (Workbox, prompt strategy)
  6. Dark mode toggle works and preference is saved (localStorage)
  7. Design follows neuroscience color principles (HSL tokens documented)
  8. Admin can approve/revoke users
**Plans**: 4 plans
- [x] 01-01-PLAN.md -- Project scaffolding + Vite 6 + React 19 + TypeScript + PWA configuration
- [x] 01-02-PLAN.md -- Neuroscience design system (HSL) + dark mode + shadcn/ui (new-york style)
- [x] 01-03-PLAN.md -- Auth database (Dexie.js) + AuthContext (split pattern) + session helpers
- [x] 01-04-PLAN.md -- Auth pages + App shell + routing (React Router v7) + verification

### Phase 2: Onboarding Questionnaire
**Goal**: First-time users complete a 4-step onboarding form collecting all lifestyle data needed for energy calculation, including circadian routine times for chronotype-aware features.
**Depends on**: Phase 1
**Requirements**: ONB-01..08
**Success Criteria** (what must be TRUE):
  1. New user is prompted to complete onboarding after first login (ProtectedRoute gate)
  2. Form collects: personal data, occupation (conditional), habits/routine, goals
  3. Circadian routine times (wake, bed, work start/end, lunch, dinner, exercise) in HH:MM
  4. Multi-step form with stepper progress bar and back navigation
  5. User can edit their profile after initial onboarding (ProfileEdit page)
  6. All collected data persisted (IndexedDB + Supabase sync on save)
**Plans**: 1 plan (retroactive)
- [x] 02-01-SUMMARY.md -- 4-step onboarding form + profile editing + Supabase sync

### Phase 3: Daily Logging
**Goal**: Users input daily data through 3-axis energy sliders and 12+ quick check-in types organized by time of day. AI generates tips and low-energy alerts.
**Depends on**: Phase 2
**Requirements**: LOG-01..08
**Success Criteria** (what must be TRUE):
  1. User can log physical, mental, emotional energy (1-10 sliders)
  2. 12+ check-in types: sleep_quality, water, caffeine, meals, focus, stress, mood, nap, screen_break, supplements, activity_done
  3. Time-phased check-ins: morning <11h, midday <14h, afternoon <18h, evening
  4. AI quick tips cached per day via Groq
  5. Low-energy alerts triggered when average < 5
  6. All logs timestamped with date + time fields
  7. Goal auto-increment from linked check-ins (water → water goals)
**Plans**: 1 plan (retroactive)
- [x] 03-01-SUMMARY.md -- Energy logging + 12+ quick check-in types + time-phased prompts + AI tips

### Phase 4: Energy Engine + AI Integration
**Goal**: Scientific energy model computes scores from profile + daily logs across 4 components (0-25 each, 0-100 total). Groq AI analyzes data for personalized advice, predictions, and pattern detection. Chronotype detection and ML trend analysis.
**Depends on**: Phase 3
**Requirements**: ENRG-01..08, AI-01..08
**Success Criteria** (what must be TRUE):
  1. 4-component model: circadian (Borbely), sleep (Van Dongen), lifestyle (Ganio/Nehlig), allostatic (McEwen)
  2. Total score 0-100 with multiplicative interaction penalty
  3. Chronotype detection: lion/bear/wolf/dolphin (Breus model)
  4. 12-hour predicted energy curve (6 data points)
  5. EWMA 14-day rolling baselines for personalization
  6. Groq AI generates Italian advice, predictions, alerts
  7. ML engine: 7/14/30 day trend analysis
  8. Hybrid analysis for admin (cross-user patterns)
**Plans**: 1 plan (retroactive)
- [x] 04-01-SUMMARY.md -- Scientific 4-component model + Groq AI + chronotype + predictions + ML trends

### Phase 5: Dashboard & Visualization
**Goal**: Users see their energy state, recommendations, goals, and history on a clear dashboard with admin-specific widgets. Energy orientation system provides actionable "what to do now" recommendations.
**Depends on**: Phase 4
**Requirements**: DASH-01..07
**Success Criteria** (what must be TRUE):
  1. Time-aware Italian greeting (Buongiorno/Buon pomeriggio/Buonasera)
  2. Admin stats grid: users, feedback, sessions, active today
  3. Quick check-ins embedded in dashboard
  4. "Cosa fare adesso" -- top recommendation from energy orientation with reasoning
  5. Goals widget with active count and streak display
  6. Daily history (last 7 days with mini-charts)
  7. Intelligence link to Insights page (after 3+ days data)
  8. Auto-refresh on visibility change
**Plans**: 1 plan (retroactive)
- [x] 05-01-SUMMARY.md -- Dashboard with widgets, orientation, daily history, admin stats, insights link

### Phase 6: Goals & Smart Balancing
**Goal**: Users set goals using the evidence-based MCII/WOOP framework with AI wizard assistance. Energy budget prevents overcommitment. Chronotype-based scheduling optimizes goal timing.
**Depends on**: Phase 5
**Requirements**: GOAL-01..09
**Success Criteria** (what must be TRUE):
  1. WOOP framework: Wish, Outcome, Obstacle, Plan for each goal
  2. AI wizard: Quick mode + Template mode (10+ Italian) + Custom mode
  3. Energy budget: 60% daily allocation, >70% overload warning
  4. Chronotype scheduling: optimal windows per lion/bear/wolf/dolphin
  5. Goal categories: energy, sleep, fitness, stress, nutrition, productivity, custom
  6. Timeframes: daily, weekly, monthly
  7. Streak tracking (current + best), status management (active/paused/completed/abandoned)
  8. Linked check-in auto-progress (water → water goals, stress → stress goals)
**Plans**: 1 plan (retroactive)
- [x] 06-01-SUMMARY.md -- WOOP goals + AI wizard (3 modes) + energy budget + chronotype scheduling + streaks

### Phase 7: Notifications + Learning System
**Goal**: Smart browser notifications with sound, habit intelligence system that learns user patterns and generates context-aware prompts, AI-assisted feedback chat, and screen time tracking. The learning system is the core differentiator.
**Depends on**: Phase 6
**Requirements**: NOTIF-01..04, HABIT-01..07, TRACK-01..05, FEED-01..04
**Success Criteria** (what must be TRUE):
  1. Browser notifications via Notification API + Service Worker
  2. Sound alerts via Web Audio API (gentle for suggestions, alert for warnings)
  3. App badge (navigator.setAppBadge) for PWA unread count
  4. Habit intelligence: 14-day pattern analysis with time clustering
  5. Smart notification generation: optimal times, quick-response options, spam prevention
  6. Regularity scoring + energy correlation analysis per habit
  7. AI-assisted feedback chat (Groq categorization, multi-turn, attachments)
  8. Screen time auto-tracking (minutes, sessions, longest session)
  9. Admin notification hooks for new feedback
**Plans**: 3 plans
- [x] 07-01-SUMMARY.md -- PWA notifications + habit intelligence + feedback chat + screen time tracking
- [x] 07-02-PLAN.md -- Wire SmartHabitPrompt into Dashboard + scheduled check-in reminders
- [x] 07-03-PLAN.md -- Notification preferences UI in Settings (sound, quiet hours, frequency)

### Phase 8: Owner Data Panel
**Goal**: Admin dashboard where the app owner can manage users, view all collected data per-user, manage feedback, and run hybrid AI analysis across all users.
**Depends on**: Phase 7
**Requirements**: DATA-01..05
**Success Criteria** (what must be TRUE):
  1. User management: approve, revoke, delete, reset password
  2. Per-user drill-down: profile, energy logs, Sahha scores, biomarkers, check-ins, goals, screen time
  3. Stats grid: total users, approved, sessions, active today, unread feedback
  4. Feedback management: view, reply, delete with AI categorization
  5. Hybrid AI analysis: cross-user patterns, churn risk, feature adoption
  6. Italian time-ago labels throughout (ora, N min fa, N h fa, N gg fa)
**Plans**: 1 plan (retroactive)
- [x] 08-01-SUMMARY.md -- Admin dashboard + user management + feedback management + hybrid AI analysis

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. PWA Shell + Auth + Design System | 4/4 | Complete | 2026-02-13 |
| 2. Onboarding Questionnaire | 1/1 | Complete | 2026-02-14 |
| 3. Daily Logging | 1/1 | Complete | 2026-02-14 |
| 4. Energy Engine + AI | 1/1 | Complete | 2026-02-14 |
| 5. Dashboard & Visualization | 1/1 | Complete | 2026-02-14 |
| 6. Goals & Smart Balancing | 1/1 | Complete | 2026-02-14 |
| 7. Notifications + Learning System | 3/3 | Complete | 2026-02-15 |
| 8. Owner Data Panel | 1/1 | Complete | 2026-02-14 |

## Remaining Gaps

None — all gaps closed.

## Resolved (All Gaps)

| Gap | Resolution |
|-----|-----------|
| ~~SmartHabitPrompt not wired~~ | RESOLVED: 07-02 — integrated into Dashboard after QuickCheckins |
| ~~Notification preferences UI~~ | RESOLVED: 07-03 — Preferenze Notifiche card in Settings |
| ~~Scheduled Reminders~~ | RESOLVED: 07-02 — checkin-reminders.ts with pattern-based setTimeout scheduling |
| ~~Habit Intelligence skeleton~~ | RESOLVED: habit-intelligence.ts is fully implemented (344 lines), was mislabeled |
| ~~Goal Auto-Completion~~ | RESOLVED: linked check-in types auto-track progress |
| ~~Data Export~~ | Deferred to v2 (EXPORT-01..02) |
| ~~Push Notifications~~ | Deferred to v2 (PUSH-01..02) |
| ~~Screenshot Support~~ | Deferred to v2 (manual input sufficient) |
| ~~Calendar View~~ | Deferred to v2 (VIS-01) |

---
*Roadmap defined: 2026-02-11*
*Last updated: 2026-02-15 -- all Phase 7 gaps closed (07-02, 07-03), milestone v1 100% complete*
