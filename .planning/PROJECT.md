# Vector

## What This Is

Vector is a PWA (Progressive Web App) that calculates, tracks, and predicts a user's energy levels across three dimensions -- physical, mental, and emotional -- based on their lifestyle profile, daily inputs (sleep, hydration, food, phone usage, work shifts, fatigue type), wearable health data (Sahha), and ongoing behavioral patterns. The app uses AI (Groq API) to analyze data, generate personalized advice, alert users when something is off, and improve predictions over time by learning the user's routine through a habit intelligence system. Users set goals using the MCII/WOOP framework (daily, weekly, short/long-term) and the app balances priorities based on energy budget and chronotype, suggesting what to push and what to recover from. Data syncs across devices via Supabase. Design is minimal, professional, and uses neuroscience-based color choices with dark mode support. All UI is in Italian.

## Core Value

A single place where users see their real energy state (physical + mental + emotional), understand why they feel the way they do, get AI-driven predictions of what happens if nothing changes, and receive actionable advice to optimize their day -- all improving over time as the app learns their routine through habit pattern analysis, wearable data, and behavioral tracking.

## Requirements

### Validated

- [x] Password-protected authentication with T&C acceptance and admin approval workflow
- [x] Installable PWA (add to home screen, offline shell, service worker)
- [x] Onboarding questionnaire (personal data, occupation, habits/routine with circadian times, goals)
- [x] Daily logging: 3-axis energy sliders (1-10) + 12+ quick check-in types phased by time of day
- [x] Scientific energy calculation engine (4 components: circadian, sleep, lifestyle, allostatic, 0-100)
- [x] AI integration (Groq API) for analysis, predictions, tips, and alerts
- [x] Dashboard with time-aware greeting, admin stats, orientation, goals widget, daily history
- [x] WOOP goals system with AI wizard (3 modes), energy budget, chronotype scheduling, streaks
- [x] Smart notifications (browser + service worker + sound) with feedback requests
- [x] Habit intelligence system that learns user routine and generates smart notifications
- [x] Wearable integration (Sahha API) for health scores and biomarkers
- [x] Cross-device data sync (Supabase) with local-only fallback
- [x] Health page with Sahha scores, biomarkers, charts
- [x] Admin dashboard with user management, feedback, hybrid AI analysis
- [x] Energy orientation system with activity recommendations
- [x] AI-assisted feedback chat with Groq categorization
- [x] Screen time auto-tracking
- [x] Dark mode toggle with neuroscience-based minimal professional design
- [x] Long-term data persistence (IndexedDB via Dexie, 18 tables)
- [x] Time-aware calculations and suggestions (chronotype detection)

### Active (Gap Closure)

- [ ] Wire SmartHabitPrompt component into Dashboard
- [ ] Scheduled check-in reminder system
- [ ] Notification preferences UI (sound, quiet hours, frequency)

### Out of Scope

- Native mobile apps (iOS/Android) -- PWA-first
- OAuth / social login -- password auth for v1
- Social features -- single-user tracker
- Payment / subscription -- free for v1
- Multi-language i18n -- Italian first
- CSV/PDF data export -- v2
- Calendar view for energy history -- v2
- Firebase/FCM push notifications -- v2

## Context

- The app must work long-term: data accumulated over weeks/months is the core value
- User behavior frequencies are tracked via habit intelligence (14-day analysis windows)
- The owner sees all collected data via admin dashboard with hybrid AI analysis
- Energy model: 4 scientific components (circadian Borbely Two-Process, sleep Van Dongen, lifestyle, allostatic McEwen), 0-100 total score
- Chronotype detection (lion/bear/wolf/dolphin) drives scheduling and recommendations
- Three energy dimensions: physical, mental, emotional -- plus a total score with interaction penalty
- EWMA 14-day rolling baselines personalize scoring to individual patterns
- AI (Groq) analyzes patterns, generates Italian advice, makes 12h predictions, and improves over time
- Wearable data (Sahha) provides objective health metrics: sleep, activity, wellbeing, readiness, mental wellbeing, biomarkers (steps, HR, sleep duration)
- Goals use MCII/WOOP framework with AI wizard (evidence-based, Oettingen 2012)
- Notifications are smart: based on habit patterns, not random/spammy
- Design: minimal, functional, organized, professional, neuroscience-informed HSL colors
- Time-of-day awareness affects energy calculations, check-in prompts, and suggestions
- Graceful degradation: app works fully local without Supabase/Sahha configured

## Constraints

- **Platform**: PWA -- installable on home screen, offline shell, mobile-first
- **Auth**: Password-based with admin approval, T&C required before registration
- **AI**: Groq API (key in .env or fetched from Supabase app_config, NEVER committed)
- **Design**: Minimal, professional, neuroscience-based HSL colors, dark mode
- **Persistence**: IndexedDB (Dexie v13, 18 tables) + Supabase sync (optional)
- **Wearable**: Sahha API (sandbox direct + production via Supabase Edge Functions)
- **Privacy**: User data shared only with app owner via admin panel
- **Notifications**: Smart (habit-pattern-driven), not spammy, with feedback-request mechanism
- **Language**: All UI in Italian
- **Deployment**: GitHub Pages with /Vector-test basename

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript + Vite 6 |
| UI Components | shadcn/ui (Radix UI + new-york style) |
| Styling | Tailwind CSS v4 (@tailwindcss/vite plugin), HSL color tokens |
| Database | Dexie.js v4 (IndexedDB wrapper, v13 schema, 18 tables) |
| State | React Context API (split pattern for auth) |
| PWA | vite-plugin-pwa + Workbox (prompt strategy) |
| AI | Groq API (Llama models, OpenAI-compatible) |
| Backend | Supabase (cross-device sync, Edge Functions, optional) |
| Wearable | Sahha API (sandbox + production modes) |
| Charts | Recharts |
| Routing | React Router v7 (12 protected routes) |
| Icons | Lucide React |

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Bootstrap with BMAD + GSD + Ralph | Structured AI-driven development workflow | Active |
| PWA over native app | Installable, cross-platform, no app store needed | Active |
| Password auth with admin approval | Controlled access, simpler for v1 | Active |
| Scientific 4-component energy model | Borbely, Van Dongen, McEwen -- peer-reviewed foundations | Active |
| Three energy dimensions + total | Physical + Mental + Emotional = Total (0-100) | Active |
| Groq API for AI | Fast inference, OpenAI-compatible, free tier | Active |
| Sahha for wearable data | Health scores + biomarkers without native SDK | Active |
| Supabase for sync | Cross-device data, Edge Functions, optional | Active |
| MCII/WOOP goal framework | Evidence-based (effect size g=0.277-0.465, 2x success) | Active |
| Habit intelligence system | Pattern analysis + smart notification generation | Active |
| Neuroscience-based design | HSL colors affect mood/productivity, backed by research | Active |
| Italian UI | Single-language first, user base is Italian | Active |
| Dexie v13 with 18 tables | Comprehensive local persistence, offline-first | Active |

---
*Last updated: 2026-02-14 -- full vision updated with Sahha, Supabase, habit intelligence, WOOP, health page*
