# Roadmap: Vector

## Overview

Vector is built in 8 phases, each delivering a working increment. We start with the installable PWA shell, auth, and design system. Then onboarding collects the user's lifestyle profile. Daily logging enables real-time data input. The energy engine + AI (Groq) computes scores and generates insights. The dashboard visualizes everything. Goals let users plan and prioritize. Notifications and the learning system close the feedback loop. Finally, the owner panel provides organized access to all collected data.

## Phases

- [x] **Phase 1: PWA Shell + Auth + Design System** - Installable app, password login, T&C, dark mode, neuroscience colors
- [x] **Phase 2: Onboarding Questionnaire** - Collect user lifestyle profile (age, weight, work, aspirations, vices, flags)
- [x] **Phase 3: Daily Logging** - Sleep, phone usage, work shift, fatigue type, hydration, food input
- [x] **Phase 4: Energy Engine + AI** - Calculate energy scores, integrate Groq API for analysis and predictions
- [x] **Phase 5: Dashboard & Visualization** - Energy profile, trends, predictions, personalized advice
- [x] **Phase 6: Goals & Smart Balancing** - Daily/weekly/long-term goals with AI-driven priority balancing
- [~] **Phase 7: Notifications + Learning System** - Smart notifications, feedback loops, routine learning, tracking
- [x] **Phase 8: Owner Data Panel** - Organized data access for the app owner

## Phase Details

### Phase 1: PWA Shell + Auth + Design System
**Goal**: A working PWA installable on the home screen, with password auth, T&C acceptance, dark mode toggle, and the neuroscience-based design system that all future phases build on.
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01..05, PWA-01..03, DESIGN-01..05
**Success Criteria** (what must be TRUE):
  1. User can install the app on their phone's home screen
  2. App shows a login wall -- no content visible without authentication
  3. New user must accept T&C before registration completes
  4. User session persists after closing and reopening the app
  5. App shell loads even when offline
  6. Dark mode toggle works and preference is saved
  7. Design follows neuroscience color principles (documented in design tokens)
**Plans**: 4 plans
- [x] 01-01-PLAN.md -- Project scaffolding + Vite + React 19 + PWA configuration
- [x] 01-02-PLAN.md -- Neuroscience design system + dark mode + shadcn/ui components
- [x] 01-03-PLAN.md -- Auth database (Dexie.js) + AuthContext + helpers
- [x] 01-04-PLAN.md -- Auth pages + App shell + routing + verification checkpoint

### Phase 2: Onboarding Questionnaire
**Goal**: First-time users complete a multi-step onboarding form collecting all lifestyle data needed for energy calculation.
**Depends on**: Phase 1
**Requirements**: ONB-01..08
**Success Criteria** (what must be TRUE):
  1. New user is prompted to complete onboarding after first login
  2. Form collects: age, weight, student/worker status, work type, schedule, aspirations, vices, segnalazioni
  3. Multi-step form with progress indicator and back navigation
  4. User can edit their profile after initial onboarding
  5. All collected data is persisted
**Plans**: 1 plan (retroactive)
- [x] 02-01-SUMMARY.md -- 4-step onboarding form + profile editing + Supabase sync

### Phase 3: Daily Logging
**Goal**: Users can input daily data (sleep, phone usage, work shift, fatigue type, hydration, food) manually or via screenshots. The app proactively asks relevant questions during the day.
**Depends on**: Phase 2
**Requirements**: LOG-01..08
**Success Criteria** (what must be TRUE):
  1. User can log sleep duration and quality
  2. User can log phone/screen usage (manual or screenshot)
  3. User can log work shift, fatigue type, hydration, food
  4. All logs are timestamped
  5. App prompts relevant questions based on time of day
**Plans**: 1 plan (retroactive)
- [x] 03-01-SUMMARY.md -- Energy logging + 12+ quick check-in types + time-phased prompts

### Phase 4: Energy Engine + AI Integration
**Goal**: The system computes energy scores (physical, mental, emotional, total) from profile + daily logs, and the Groq AI analyzes data to generate personalized advice and predictions.
**Depends on**: Phase 3
**Requirements**: ENRG-01..08, AI-01..07
**Success Criteria** (what must be TRUE):
  1. Energy scores are calculated from all available data
  2. Physical, mental, emotional, and total scores are computed separately
  3. Segnalazioni weigh heavily in calculations
  4. Groq AI generates personalized advice
  5. AI produces predictions ("if nothing changes...")
  6. AI alerts when energy is low or habits are harmful
  7. Stress level and fatigue type are identified
**Plans**: 1 plan (retroactive)
- [x] 04-01-SUMMARY.md -- Scientific 4-component model + Groq AI + chronotype + predictions

### Phase 5: Dashboard & Visualization
**Goal**: Users see their energy scores, predictions, trends, and personalized advice on a clear, informative dashboard.
**Depends on**: Phase 4
**Requirements**: DASH-01..06
**Success Criteria** (what must be TRUE):
  1. Dashboard shows total + individual energy scores with visual indicators
  2. Predictions and trends are displayed (charts/graphs)
  3. Personalized advice and alerts are visible
  4. User can see accumulated stress
  5. Information is educational and helps user understand their state
**Plans**: 1 plan (retroactive)
- [x] 05-01-SUMMARY.md -- Dashboard with widgets, orientation, daily history, admin stats

### Phase 6: Goals & Smart Balancing
**Goal**: Users set goals at different time horizons with importance levels. The AI suggests which goals to focus on based on current energy and balances productivity vs recovery.
**Depends on**: Phase 5
**Requirements**: GOAL-01..06
**Success Criteria** (what must be TRUE):
  1. User can create daily, weekly, short-term, and long-term goals
  2. Goals have priority/importance levels
  3. AI recommends which goals to focus on given current energy
  4. App suggests productivity actions vs recovery actions
  5. Goals interact with the energy dashboard
**Plans**: 1 plan (retroactive)
- [x] 06-01-SUMMARY.md -- WOOP goals + AI wizard + energy budget + chronotype scheduling

### Phase 7: Notifications + Learning System
**Goal**: Smart notifications with logical timing, targeted feedback requests, and the learning system that improves predictions by studying user routine. Long-term tracking and frequency analysis.
**Depends on**: Phase 6
**Requirements**: NOTIF-01..04, TRACK-01..04
**Success Criteria** (what must be TRUE):
  1. Notifications fire at logical times (not random)
  2. Notifications request specific feedback to update predictions
  3. App tracks behavior frequencies over time
  4. Historical data is preserved and trends are viewable
  5. Predictions improve as the app learns the user's routine
**Plans**: 1 plan (retroactive)
- [x] 07-01-SUMMARY.md -- PWA notifications + feedback chat + screen time tracking
**Gaps identified**:
- [ ] Habit Intelligence system (habit-intelligence.ts is skeleton only)
- [ ] Scheduled reminder system for check-ins
- [ ] Push notifications (Firebase/FCM for mobile)

### Phase 8: Owner Data Panel
**Goal**: The app owner can access all collected user data in an organized, structured format.
**Depends on**: Phase 7
**Requirements**: DATA-01..03
**Success Criteria** (what must be TRUE):
  1. Owner can see all user profiles and their data
  2. Owner can see energy scores, daily logs, and behavior frequencies per user
  3. Data is presented in structured tables and summaries
**Plans**: 1 plan (retroactive)
- [x] 08-01-SUMMARY.md -- Admin dashboard + user management + feedback + hybrid analysis

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. PWA Shell + Auth + Design System | 4/4 | Complete | 2026-02-13 |
| 2. Onboarding Questionnaire | 1/1 | Complete (retroactive) | 2026-02-14 |
| 3. Daily Logging | 1/1 | Complete (retroactive) | 2026-02-14 |
| 4. Energy Engine + AI | 1/1 | Complete (retroactive) | 2026-02-14 |
| 5. Dashboard & Visualization | 1/1 | Complete (retroactive) | 2026-02-14 |
| 6. Goals & Smart Balancing | 1/1 | Complete (retroactive) | 2026-02-14 |
| 7. Notifications + Learning System | 1/1 | Partial (gaps: habit learning, push, reminders) | 2026-02-14 |
| 8. Owner Data Panel | 1/1 | Complete (retroactive) | 2026-02-14 |

## Identified Gaps (Cross-Phase)

| Gap | Phase | Severity | Description |
|-----|-------|----------|-------------|
| Habit Intelligence | 7 | Critical | habit-intelligence.ts is skeleton — no real habit learning |
| Goal Auto-Completion | 6 | Moderate | Goals don't auto-complete from linked check-ins |
| Data Export | 8 | Moderate | No CSV/PDF export for admin or user |
| Push Notifications | 7 | Moderate | Browser-only, no Firebase/FCM for mobile |
| Scheduled Reminders | 7 | Moderate | No time-based check-in reminders |
| Screenshot Support | 3 | Low | Phone usage via manual input only |
| Calendar View | 5 | Low | Energy history is list-only, no calendar grid |

---
*Roadmap defined: 2026-02-11*
*Last updated: 2026-02-14 -- All phases formally audited and documented with retroactive summaries*
