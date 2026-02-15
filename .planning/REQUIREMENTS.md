# Requirements: Vector

**Defined:** 2026-02-11
**Updated:** 2026-02-14
**Core Value:** See your real energy state, understand why, get AI predictions, receive actionable advice -- improving over time through habit learning and wearable data

## v1 Requirements

### Authentication & Terms (AUTH)

- [x] **AUTH-01**: App shows a login screen before any content is accessible
- [x] **AUTH-02**: User can register with a password
- [x] **AUTH-03**: User must accept terms and conditions before registration completes
- [x] **AUTH-04**: User session persists across browser restarts (30-day expiration)
- [x] **AUTH-05**: User can log out
- [x] **AUTH-06**: Admin approval workflow -- new users need admin approval before using app
- [x] **AUTH-07**: Admin can approve, revoke, delete users, and reset passwords

### Progressive Web App (PWA)

- [x] **PWA-01**: App can be installed / added to home screen on mobile
- [x] **PWA-02**: App has a service worker and web manifest (VitePWA + Workbox)
- [x] **PWA-03**: App shell loads when offline (cached, prompt strategy for updates)

### Design System (DESIGN)

- [x] **DESIGN-01**: Dark mode toggle (user preference persisted in localStorage)
- [x] **DESIGN-02**: Neuroscience-based HSL color palette (calm blues/greens, energy oranges/yellows, stress pink)
- [x] **DESIGN-03**: Minimal, functional, organized, professional layout
- [x] **DESIGN-04**: Mobile-first responsive design
- [x] **DESIGN-05**: Consistent component library (shadcn/ui new-york style: buttons, cards, inputs, etc.)

### Onboarding Profile (ONB)

- [x] **ONB-01**: User provides age (birth year) and weight during onboarding
- [x] **ONB-02**: User indicates if they are a student, worker, student_worker, unemployed, or retired
- [x] **ONB-03**: User describes their work type / profession (conditional on occupation)
- [x] **ONB-04**: User provides work schedules (regular/shifts/flexible/irregular) + daily hours
- [x] **ONB-05**: User selects primary goal (more_energy, better_sleep, fitness, stress, general_wellness)
- [x] **ONB-06**: User reports vices/bad habits (smoking, alcohol, caffeine frequency)
- [x] **ONB-07**: User provides circadian routine times (wake, bed, work start/end, lunch, dinner, exercise)
- [x] **ONB-08**: User can edit their profile after onboarding (ProfileEdit page)

### Daily Logging (LOG)

- [x] **LOG-01**: User logs energy levels on 3-axis sliders (physical, mental, emotional, 1-10)
- [x] **LOG-02**: User logs via 12+ quick check-in types (sleep_quality, water, caffeine, meals, focus, stress, mood, nap, screen_break, supplements, activity_done)
- [x] **LOG-03**: User logs current work hours and activity type (idle/study/work/rest/sport/leisure/social/errands)
- [x] **LOG-04**: Fatigue type derived from energy engine calculations (physical/mental/emotional/mixed)
- [x] **LOG-05**: User logs hydration level (water check-ins with count tracking)
- [x] **LOG-06**: User logs food / meals (meal_time check-in with quality scale 1-5)
- [x] **LOG-07**: App shows time-phased check-ins: morning <11h, midday <14h, afternoon <18h, evening
- [x] **LOG-08**: All logs are timestamped with date + time fields

### Energy Calculation (ENRG)

- [x] **ENRG-01**: System calculates a total energy score (0-100) with multiplicative interaction penalty
- [x] **ENRG-02**: Circadian component (0-25): Borbely Two-Process Model, BRAC 90-min cycles, post-prandial dip
- [x] **ENRG-03**: Sleep component (0-25): duration vs optimal, quality, Van Dongen 7-day debt, nap recovery
- [x] **ENRG-04**: Lifestyle component (0-25): hydration (Ganio 33ml/kg), nutrition, caffeine (Nehlig half-life=5h), activity (POMS), smoking/alcohol, screen time
- [x] **ENRG-05**: Allostatic load component (0-25): McEwen model, stress cumulativity, burnout risk, recovery deficit, emotional drain
- [x] **ENRG-06**: Energy scores update when new data is logged
- [x] **ENRG-07**: Chronotype detection (lion/bear/wolf/dolphin) drives optimal energy windows
- [x] **ENRG-08**: EWMA 14-day rolling baselines personalize scoring over time

### AI Analysis & Predictions (AI)

- [x] **AI-01**: Groq API integration for data analysis (OpenAI-compatible, Llama models)
- [x] **AI-02**: AI generates personalized advice in Italian based on user data
- [x] **AI-03**: AI produces 12-hour energy curve predictions (6 data points)
- [x] **AI-04**: AI alerts user when energy is low (average < 5 triggers alert)
- [x] **AI-05**: AI suggests what to change and why (orientation recommendations with reasoning)
- [x] **AI-06**: AI improves predictions via EWMA baselines and adaptive component weights
- [x] **AI-07**: ML engine identifies stress type and fatigue type (7/14/30 day trend windows)
- [x] **AI-08**: Hybrid analysis for admin: cross-user pattern detection, churn risk, feature adoption

### User Profile & Dashboard (DASH)

- [x] **DASH-01**: User sees energy scores on their profile (total, physical, mental, emotional)
- [x] **DASH-02**: Dashboard shows time-aware Italian greeting + current energy state
- [x] **DASH-03**: Dashboard shows energy orientation ("Cosa fare adesso") with top recommendation
- [x] **DASH-04**: Dashboard shows active goals count and streak info
- [x] **DASH-05**: Dashboard shows daily history (last 7 days with mini-charts)
- [x] **DASH-06**: Intelligence link to Insights page (visible after 3+ days of data)
- [x] **DASH-07**: Admin stats grid (users, feedback, sessions, active today) on dashboard

### Goals System (GOAL)

- [x] **GOAL-01**: User can set daily, weekly, and monthly goals
- [x] **GOAL-02**: Goals use MCII/WOOP framework (Wish, Outcome, Obstacle, Plan)
- [x] **GOAL-03**: AI wizard with 3 creation modes (Quick, Template, Custom)
- [x] **GOAL-04**: 10+ Italian goal templates (hydration, exercise, sleep, meditation, reading, etc.)
- [x] **GOAL-05**: Energy budget allocation (60% daily) with overload detection (>70% warning)
- [x] **GOAL-06**: Chronotype-based scheduling (optimal windows per lion/bear/wolf/dolphin)
- [x] **GOAL-07**: Goal categories (energy, sleep, fitness, stress, nutrition, productivity, custom)
- [x] **GOAL-08**: Streak tracking (current + best) with status (active/paused/completed/abandoned)
- [x] **GOAL-09**: Linked check-in types auto-track goal progress (water → water goals, stress → stress goals)

### Smart Notifications (NOTIF)

- [x] **NOTIF-01**: Browser notifications via Notification API + Service Worker
- [x] **NOTIF-02**: Energy orientation alerts (dip warnings, crash predictions) with sound
- [x] **NOTIF-03**: App badge (navigator.setAppBadge) for Chrome PWA unread count
- [x] **NOTIF-04**: Notification permission prompt component

### Habit Intelligence & Learning (HABIT)

- [x] **HABIT-01**: Habit pattern analysis (14-day check-in windows)
- [x] **HABIT-02**: Time clustering to detect typical habit times
- [x] **HABIT-03**: Regularity scoring (very_regular, regular, irregular)
- [x] **HABIT-04**: Energy correlation analysis (positive/negative/none)
- [x] **HABIT-05**: Smart notification generation based on detected patterns
- [x] **HABIT-06**: Quick-response options for rapid feedback from notifications
- [x] **HABIT-07**: Session-level caching with 1-hour TTL

### Tracking & Persistence (TRACK)

- [x] **TRACK-01**: All data stored in IndexedDB via Dexie v13 (18 tables, survives restarts)
- [x] **TRACK-02**: User behavior frequencies tracked via habit intelligence + check-in history
- [x] **TRACK-03**: Historical energy scores preserved in scientificEnergyScores table
- [x] **TRACK-04**: Energy trends viewable via DailyHistory, Insights page, and History page
- [x] **TRACK-05**: Screen time auto-tracking (minutes, sessions, longest session)

### Wearable Integration (WEAR)

- [x] **WEAR-01**: Sahha API integration (sandbox direct + production via Supabase Edge Functions)
- [x] **WEAR-02**: Health scores: wellbeing, activity, sleep, readiness, mental_wellbeing
- [x] **WEAR-03**: Biomarkers: steps, heart rate, sleep duration, etc.
- [x] **WEAR-04**: Auto-sync every 15 minutes + on foreground return
- [x] **WEAR-05**: Health page (1500+ lines) with scores, biomarkers, charts
- [x] **WEAR-06**: Sahha data feeds into lifestyle component of energy engine

### Cross-Device Sync (SYNC)

- [x] **SYNC-01**: Supabase client with conditional initialization (works local-only when not configured)
- [x] **SYNC-02**: Profile data sync on save (pushDataToSupabase)
- [x] **SYNC-03**: Sahha webhook data sync from Supabase tables
- [x] **SYNC-04**: Groq API key fetched from Supabase app_config (fallback to .env)

### Data Sharing with Owner (DATA)

- [x] **DATA-01**: Admin dashboard with user management (approve/revoke/delete/reset)
- [x] **DATA-02**: Per-user drill-down: profile, energy logs, Sahha scores, biomarkers, check-ins, goals, screen time
- [x] **DATA-03**: Data presented in structured tables, stats grid, and summaries
- [x] **DATA-04**: Feedback management (view, reply, delete) with AI categorization
- [x] **DATA-05**: Hybrid AI analysis: cross-user patterns, churn risk, feature adoption

### Feedback System (FEED)

- [x] **FEED-01**: Multi-turn AI-assisted feedback chat with Groq
- [x] **FEED-02**: Attachments: image (compressed to max 800px) + video (max 8MB)
- [x] **FEED-03**: Categories: bug, feature, improvement, support, other
- [x] **FEED-04**: Status tracking: draft → sent → read, admin reply support

## v2 Requirements

Deferred to future release.

### Push Notifications
- **PUSH-01**: Native push notifications via Firebase/FCM
- **PUSH-02**: User can configure notification preferences (sound, quiet hours, frequency)

### Export & Reports
- **EXPORT-01**: Export personal data to CSV/PDF
- **EXPORT-02**: Weekly/monthly summary reports

### Visualization
- **VIS-01**: Calendar view for energy history
- **VIS-02**: Weekly summary card on dashboard

### Social / Sharing
- **SOCIAL-01**: Share progress with accountability partner
- **SOCIAL-02**: Anonymous community benchmarks

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native mobile apps | PWA covers mobile; native is post-v1 |
| OAuth / social login | Password auth is simpler for v1 |
| Multi-language (i18n) | Ship in Italian first |
| Social features | Single-user tracking for v1 |
| Payment / subscription | Free for v1 |
| Screenshot upload for phone usage | Manual input sufficient for v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01..07 | Phase 1 + 8 | Complete |
| PWA-01..03 | Phase 1 | Complete |
| DESIGN-01..05 | Phase 1 | Complete |
| ONB-01..08 | Phase 2 | Complete |
| LOG-01..08 | Phase 3 | Complete |
| ENRG-01..08 | Phase 4 | Complete |
| AI-01..08 | Phase 4 + 8 | Complete |
| DASH-01..07 | Phase 5 | Complete |
| GOAL-01..09 | Phase 6 | Complete |
| NOTIF-01..04 | Phase 7 | Complete |
| HABIT-01..07 | Phase 7 | Complete |
| TRACK-01..05 | Phase 7 | Complete |
| WEAR-01..06 | Cross-cutting | Complete |
| SYNC-01..04 | Cross-cutting | Complete |
| DATA-01..05 | Phase 8 | Complete |
| FEED-01..04 | Phase 7 + 8 | Complete |

**Coverage:**
- v1 requirements: 89 total (expanded from original 62 to reflect actual implementation)
- Mapped to phases: 89
- Unmapped: 0
- Complete: 86
- Active gap closure: 3 (SmartHabitPrompt wiring, scheduled reminders, notification preferences UI)

---
*Requirements defined: 2026-02-11*
*Last updated: 2026-02-14 -- expanded to 89 requirements reflecting actual implementation (Sahha, Supabase, WOOP, habit intelligence, health page, feedback system)*
