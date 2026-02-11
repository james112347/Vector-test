# Requirements: Vector

**Defined:** 2026-02-11
**Core Value:** See your real energy state, understand why, get AI predictions, receive actionable advice -- improving over time

## v1 Requirements

### Authentication & Terms (AUTH)

- [ ] **AUTH-01**: App shows a login screen before any content is accessible
- [ ] **AUTH-02**: User can register with a password
- [ ] **AUTH-03**: User must accept terms and conditions before registration completes
- [ ] **AUTH-04**: User session persists across browser restarts
- [ ] **AUTH-05**: User can log out

### Progressive Web App (PWA)

- [ ] **PWA-01**: App can be installed / added to home screen on mobile
- [ ] **PWA-02**: App has a service worker and web manifest
- [ ] **PWA-03**: App shell loads when offline (cached)

### Design System (DESIGN)

- [ ] **DESIGN-01**: Dark mode toggle (user preference persisted)
- [ ] **DESIGN-02**: Neuroscience-based color palette (calming blues/greens for rest, warm tones for energy/alerts)
- [ ] **DESIGN-03**: Minimal, functional, organized, professional layout
- [ ] **DESIGN-04**: Mobile-first responsive design
- [ ] **DESIGN-05**: Consistent component library (buttons, cards, inputs, progress indicators)

### Onboarding Profile (ONB)

- [ ] **ONB-01**: User provides age and weight during onboarding
- [ ] **ONB-02**: User indicates if they are a student, worker, or other
- [ ] **ONB-03**: User describes their work type / profession
- [ ] **ONB-04**: User provides work schedules / typical hours
- [ ] **ONB-05**: User describes what kind of person they want to become (aspirations)
- [ ] **ONB-06**: User reports any vices / bad habits
- [ ] **ONB-07**: User can add special flags ("segnalazioni") that significantly affect energy
- [ ] **ONB-08**: User can edit their profile after onboarding

### Daily Logging (LOG)

- [ ] **LOG-01**: User logs sleep duration and quality (manual input or screenshot)
- [ ] **LOG-02**: User logs phone/screen usage (manual input or screenshot upload)
- [ ] **LOG-03**: User logs current work shift / turn
- [ ] **LOG-04**: User logs type of fatigue (physical, mental, emotional, mixed)
- [ ] **LOG-05**: User logs hydration level
- [ ] **LOG-06**: User logs food / meals
- [ ] **LOG-07**: App proactively asks during the day: "How did you sleep?", "What shift are you on?", etc.
- [ ] **LOG-08**: All logs are timestamped and time-of-day aware

### Energy Calculation (ENRG)

- [ ] **ENRG-01**: System calculates a total energy score from profile + daily logs
- [ ] **ENRG-02**: System calculates a physical energy component
- [ ] **ENRG-03**: System calculates a mental energy component
- [ ] **ENRG-04**: System calculates an emotional energy component
- [ ] **ENRG-05**: Special flags ("segnalazioni") weigh heavily in the calculation
- [ ] **ENRG-06**: Energy scores update in real-time as new data is logged
- [ ] **ENRG-07**: Time-of-day affects energy calculations (morning vs evening context)
- [ ] **ENRG-08**: Stress level is calculated and shown alongside energy

### AI Analysis & Predictions (AI)

- [ ] **AI-01**: Groq API integration for data analysis
- [ ] **AI-02**: AI generates personalized advice based on user data
- [ ] **AI-03**: AI produces predictions: "If nothing changes, in X days your energy will be..."
- [ ] **AI-04**: AI alerts user when energy is low or habits are harmful
- [ ] **AI-05**: AI suggests what to change and why (informative, educational)
- [ ] **AI-06**: AI improves predictions over time by learning user routine
- [ ] **AI-07**: AI helps user understand their stress type and fatigue type

### User Profile & Dashboard (DASH)

- [ ] **DASH-01**: User sees their energy scores (total, physical, mental, emotional) on their profile
- [ ] **DASH-02**: Dashboard shows current energy state with visual indicators
- [ ] **DASH-03**: Dashboard shows predictions and trends
- [ ] **DASH-04**: Dashboard shows personalized advice and alerts
- [ ] **DASH-05**: User can see how much stress they've accumulated
- [ ] **DASH-06**: Information is educational -- helps user understand their state

### Goals System (GOAL)

- [ ] **GOAL-01**: User can set daily goals
- [ ] **GOAL-02**: User can set weekly goals
- [ ] **GOAL-03**: User can set short-term and long-term goals
- [ ] **GOAL-04**: Goals have importance/priority levels
- [ ] **GOAL-05**: App suggests which goals to focus on based on current energy
- [ ] **GOAL-06**: App balances productivity vs recovery in goal recommendations

### Smart Notifications (NOTIF)

- [ ] **NOTIF-01**: Notifications follow logical timing (not random/spammy)
- [ ] **NOTIF-02**: Notifications request targeted feedback to update predictions
- [ ] **NOTIF-03**: Notification frequency adapts to user routine
- [ ] **NOTIF-04**: Notifications include actionable context (not just "open app")

### Tracking & Persistence (TRACK)

- [ ] **TRACK-01**: All user data is stored persistently (survives app restarts)
- [ ] **TRACK-02**: User behavior frequencies are tracked over time
- [ ] **TRACK-03**: Historical energy scores are preserved (not overwritten)
- [ ] **TRACK-04**: User can see their energy trends over time

### Data Sharing with Owner (DATA)

- [ ] **DATA-01**: App owner can access all collected user data in an organized format
- [ ] **DATA-02**: Data includes profile info, energy scores, daily logs, behavior frequencies
- [ ] **DATA-03**: Data is aggregated / structured (not raw dumps)

## v2 Requirements

Deferred to future release.

### Push Notifications
- **PUSH-01**: Native push notifications via service worker
- **PUSH-02**: User can configure notification preferences

### Export & Reports
- **EXPORT-01**: Export personal data to CSV/PDF
- **EXPORT-02**: Weekly/monthly summary reports

### Social / Sharing
- **SOCIAL-01**: Share progress with accountability partner
- **SOCIAL-02**: Anonymous community benchmarks

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native mobile apps | PWA covers mobile; native is post-v1 |
| OAuth / social login | Password auth is simpler for v1 |
| Multi-language (i18n) | Ship in one language first |
| Social features | Single-user tracking for v1 |
| Payment / subscription | Free for v1 |
| Wearable integration | No smartwatch/fitbit for v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01..05 | Phase 1 | Pending |
| PWA-01..03 | Phase 1 | Pending |
| DESIGN-01..05 | Phase 1 | Pending |
| ONB-01..08 | Phase 2 | Pending |
| LOG-01..08 | Phase 3 | Pending |
| ENRG-01..08 | Phase 4 | Pending |
| AI-01..07 | Phase 4 | Pending |
| DASH-01..06 | Phase 5 | Pending |
| GOAL-01..06 | Phase 6 | Pending |
| NOTIF-01..04 | Phase 7 | Pending |
| TRACK-01..04 | Phase 7 | Pending |
| DATA-01..03 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 62 total
- Mapped to phases: 62
- Unmapped: 0

---
*Requirements defined: 2026-02-11*
*Last updated: 2026-02-11 -- full product vision*
