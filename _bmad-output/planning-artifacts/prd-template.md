---
stepsCompleted: []
inputDocuments: []
workflowType: 'prd'
---

# Product Requirements Document - Vector

**Author:** Owner
**Date:** 2026-02-11

## 1. Executive Summary

Vector is a Progressive Web App (PWA) that tracks, calculates, and predicts a user's energy across three dimensions -- physical, mental, and emotional. Users input their lifestyle profile at onboarding and log daily data (sleep, food, hydration, phone usage, work shifts, fatigue). An AI engine (Groq API) analyzes this data to generate personalized advice, energy predictions, and alerts. Users set goals with importance levels and the app balances priorities. The app learns the user's routine over time, improving its predictions. Design is minimal, professional, and uses neuroscience-based colors with dark mode support. All collected data is shared with the app owner in an organized format.

## 2. Problem Statement

People lack visibility into how their lifestyle choices affect their energy levels across physical, mental, and emotional dimensions. They don't understand why they feel drained, what type of fatigue they're experiencing, or how their daily habits compound over time. Without a structured way to capture this data and an intelligent system to analyze it, they cannot make informed decisions about their energy management. The app owner needs a tool that collects lifestyle data from users, computes their energy profile, tracks it long-term, provides AI-driven insights, and presents all data in an organized format.

## 3. Goals & Success Metrics

| Goal | Metric | Target |
|------|--------|--------|
| Users complete onboarding | % of registered users finishing questionnaire | > 80% |
| Daily engagement | % of users logging data at least once daily | > 60% |
| Long-term retention | Users returning after 7 days | > 50% |
| Data completeness | % of profile and daily log fields filled | > 85% |
| AI accuracy | User feedback on prediction quality | Improves over 30 days |
| Owner data access | Owner can view any user's full data in < 3 clicks | 100% |

## 4. Target Users / Personas

### Persona 1: The User
- **Role:** Person seeking to understand and optimize their energy and wellbeing
- **Needs:** Simple daily input; clear energy scores; understand stress and fatigue types; predictions; actionable advice; goal tracking
- **Pain Points:** Doesn't know why they feel tired; can't connect habits to energy; no tool tracks all dimensions; forgets to log; wants to improve but doesn't know where to start

### Persona 2: The App Owner
- **Role:** Person who collects and reviews aggregated user data
- **Needs:** Organized access to all user profiles, energy scores, daily logs, and behavior frequencies
- **Pain Points:** Raw data is hard to interpret; needs structured summaries per user

## 5. User Stories / Journeys

### Journey 1: First-Time User
1. Opens the app URL on their phone
2. Sees login screen (no content visible)
3. Taps "Register"
4. Reads and accepts Terms & Conditions
5. Creates account with password
6. Redirected to multi-step onboarding questionnaire
7. Completes form: age, weight, student/worker status, work type, schedule, aspirations, vices, segnalazioni
8. Sees their first energy dashboard (total, physical, mental, emotional)
9. Adds app to home screen via install prompt
10. Toggles dark mode if preferred

### Journey 2: Daily User
1. Opens app from home screen (session persists)
2. App asks: "How did you sleep?" (based on morning time)
3. User logs sleep duration + quality
4. Later, app asks: "What shift are you on?"
5. User logs work shift and fatigue type
6. During the day, logs hydration and food
7. Dashboard updates energy scores in real-time
8. AI provides advice: "Your physical energy is low -- consider hydrating more"
9. AI shows prediction: "If sleep quality stays at this level, expect 15% mental energy drop by Friday"
10. User checks goals and sees AI recommendation on what to focus on

### Journey 3: Goal-Oriented User
1. Creates a weekly goal: "Exercise 3 times"
2. Sets importance to "High"
3. App analyzes current energy and suggests: "Your physical energy supports this -- best days are Tuesday and Thursday based on your shift pattern"
4. App also suggests: "Consider a rest day on Wednesday given your accumulated fatigue"

### Journey 4: App Owner
1. Accesses owner panel
2. Sees list of all users with summary data
3. Drills into a specific user
4. Views their full profile, energy history, daily logs, behavior frequencies
5. Data is in structured tables, not raw JSON

## 6. Functional Requirements

### FR-AUTH: Authentication & Terms
- **FR-AUTH-01**: Login screen blocks all content for unauthenticated users
- **FR-AUTH-02**: Registration requires password
- **FR-AUTH-03**: T&C acceptance checkbox required before registration
- **FR-AUTH-04**: Session token persists in storage across browser restarts
- **FR-AUTH-05**: Logout clears session

### FR-PWA: Progressive Web App
- **FR-PWA-01**: Web app manifest enables "Add to Home Screen"
- **FR-PWA-02**: Service worker caches app shell
- **FR-PWA-03**: Offline fallback shows cached shell

### FR-DESIGN: Design System
- **FR-DESIGN-01**: Dark mode toggle with persisted preference
- **FR-DESIGN-02**: Neuroscience-based color palette (blues/greens for calm/rest, warm tones for energy/alerts, red for danger/low energy)
- **FR-DESIGN-03**: Minimal, functional, organized, professional layout
- **FR-DESIGN-04**: Mobile-first responsive design
- **FR-DESIGN-05**: Consistent component library

### FR-ONB: Onboarding
- **FR-ONB-01**: Multi-step form: age, weight
- **FR-ONB-02**: Student/worker/other status
- **FR-ONB-03**: Work type / profession
- **FR-ONB-04**: Work schedule / typical hours
- **FR-ONB-05**: Aspirations ("who do you want to become")
- **FR-ONB-06**: Vices / bad habits
- **FR-ONB-07**: Segnalazioni (special flags with high impact)
- **FR-ONB-08**: Profile edit screen post-onboarding

### FR-LOG: Daily Logging
- **FR-LOG-01**: Log sleep duration and quality (manual or screenshot)
- **FR-LOG-02**: Log phone/screen usage (manual or screenshot upload)
- **FR-LOG-03**: Log current work shift
- **FR-LOG-04**: Log fatigue type (physical, mental, emotional, mixed)
- **FR-LOG-05**: Log hydration level
- **FR-LOG-06**: Log food / meals
- **FR-LOG-07**: Proactive time-based prompts ("How did you sleep?", "What shift?")
- **FR-LOG-08**: All logs timestamped and time-aware

### FR-ENRG: Energy Calculation
- **FR-ENRG-01**: Total energy from profile + daily logs
- **FR-ENRG-02**: Physical energy sub-score
- **FR-ENRG-03**: Mental energy sub-score
- **FR-ENRG-04**: Emotional energy sub-score
- **FR-ENRG-05**: Segnalazioni weighted heavily
- **FR-ENRG-06**: Real-time updates on new data
- **FR-ENRG-07**: Time-of-day context in calculations
- **FR-ENRG-08**: Stress level calculation

### FR-AI: AI Analysis
- **FR-AI-01**: Groq API integration
- **FR-AI-02**: Personalized advice generation
- **FR-AI-03**: Predictive modeling ("if nothing changes...")
- **FR-AI-04**: Low energy / harmful habit alerts
- **FR-AI-05**: Educational explanations (what to change and why)
- **FR-AI-06**: Routine learning (improves over time)
- **FR-AI-07**: Stress type and fatigue type identification

### FR-DASH: Dashboard
- **FR-DASH-01**: Energy scores on user profile
- **FR-DASH-02**: Visual energy indicators
- **FR-DASH-03**: Predictions and trends
- **FR-DASH-04**: Advice and alerts
- **FR-DASH-05**: Accumulated stress view
- **FR-DASH-06**: Educational information

### FR-GOAL: Goals
- **FR-GOAL-01**: Daily goals
- **FR-GOAL-02**: Weekly goals
- **FR-GOAL-03**: Short-term and long-term goals
- **FR-GOAL-04**: Importance/priority levels
- **FR-GOAL-05**: AI-driven focus recommendations
- **FR-GOAL-06**: Productivity vs recovery balancing

### FR-NOTIF: Notifications
- **FR-NOTIF-01**: Logical timing
- **FR-NOTIF-02**: Targeted feedback requests
- **FR-NOTIF-03**: Adaptive frequency
- **FR-NOTIF-04**: Actionable context

### FR-TRACK: Tracking
- **FR-TRACK-01**: Durable storage
- **FR-TRACK-02**: Behavior frequency logging
- **FR-TRACK-03**: Energy score history
- **FR-TRACK-04**: Trend visualization

### FR-DATA: Owner Data
- **FR-DATA-01**: User list view
- **FR-DATA-02**: Per-user drill-down (profile, scores, logs, frequencies)
- **FR-DATA-03**: Structured tables and summaries

## 7. Non-Functional Requirements

- **Performance**: First load < 3s on 3G; subsequent loads < 1s (cached); AI responses < 5s
- **Security**: Passwords hashed (bcrypt/argon2); HTTPS only; API key server-side only; no plaintext secrets
- **Availability**: App shell available offline; data ops require connectivity
- **Accessibility**: Minimum AA contrast; form labels for screen readers; touch-friendly targets
- **Data integrity**: No data loss on app restart; atomic writes; timestamped logs
- **Scalability**: Support 100+ concurrent users without degradation

## 8. Scope & Boundaries

### In Scope
- Password auth with T&C gate
- PWA (installable, offline shell)
- Neuroscience-based design system with dark mode
- Onboarding questionnaire (8 data categories)
- Daily logging (sleep, phone, shift, fatigue, hydration, food)
- Energy calculation (4 scores + stress)
- AI analysis via Groq (advice, predictions, alerts, learning)
- Dashboard with visualizations and trends
- Goals system with smart balancing
- Smart notifications with feedback loops
- Long-term tracking and frequency analysis
- Owner data panel

### Out of Scope
- Native mobile apps
- OAuth / social login
- Multi-language support
- Social / sharing features
- Payment / subscription
- Wearable device integration
- AI coaching chatbot (conversational UI)

## 9. Assumptions & Dependencies

- Users have a modern mobile browser (Chrome, Safari, Firefox)
- App will be hosted on a platform that supports HTTPS
- Groq API is available and responsive (fallback: cached last response)
- App owner has access to the admin route or backend
- A backend with a database is required (not just client-side storage)
- Users are willing to log data daily (design must minimize friction)

## 10. Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Users abandon long onboarding form | H | M | Multi-step with progress; save partial progress |
| Users stop daily logging | H | H | Proactive prompts; minimal input; smart defaults |
| Energy formula feels arbitrary | M | M | Show which factors affect scores; AI explains reasoning |
| Groq API downtime | M | L | Cache last AI response; show scores without AI |
| Data privacy concerns | H | L | Clear T&C; HTTPS; hashed passwords; no third-party sharing |
| PWA install prompt not shown | M | M | Manual install instructions as fallback |
| API key exposure | H | L | Server-side only; .env protection; never in client code |

## 11. Timeline / Milestones

1. **Phase 1**: PWA Shell + Auth + Design System
2. **Phase 2**: Onboarding Questionnaire
3. **Phase 3**: Daily Logging
4. **Phase 4**: Energy Engine + AI Integration
5. **Phase 5**: Dashboard & Visualization
6. **Phase 6**: Goals & Smart Balancing
7. **Phase 7**: Notifications + Learning System
8. **Phase 8**: Owner Data Panel

---
*Created: 2026-02-11*
*Last updated: 2026-02-11 -- full product vision*
