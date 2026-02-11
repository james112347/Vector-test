# Project State

## Project Reference

See: .planning/PROJECT.md (updated: 2026-02-11)

**Core value:** See your real energy state, understand why, get AI predictions, receive actionable advice -- improving as the app learns your routine
**Current focus:** Phase 1 -- PWA Shell + Auth + Design System

## Current Position

Phase: 1 of 8 (PWA Shell + Auth + Design System)
Plan: 3 of 4 in current phase
Status: Executing Phase 1
Last activity: 2026-02-11 -- Completed plan 01-03 (Auth Data Layer & Context)

Progress: [███░░░░░░░] 37.5%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 4.5 min
- Total execution time: 0.22 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | 13.3min | 4.4min |

## Accumulated Context

### Decisions

- [Bootstrap]: BMAD + GSD + Ralph workflow
- [Product]: Energy tracking PWA with AI (Groq), 3 energy dimensions, daily logging, goals, predictions
- [Platform]: PWA-first (installable, offline shell, service worker)
- [Auth]: Password-based (no OAuth for v1)
- [AI]: Groq API (key in .env, server-side only)
- [Design]: Minimal, professional, neuroscience-based colors, dark mode
- [Energy model]: Physical + Mental + Emotional = Total, plus stress, with heavy segnalazioni weighting
- [Notifications]: Smart, logical timing, feedback-based, routine-learning
- [01-01 Tailwind]: Using Tailwind CSS v4 with new Vite plugin approach (@tailwindcss/vite)
- [01-01 PWA]: Configured VitePWA with 'prompt' strategy for user-controlled updates
- [01-01 Dark Mode]: Dark mode flash prevention with inline script before page render
- [01-03 Auth Context]: Split context pattern (AuthStateContext + AuthActionsContext) to prevent unnecessary re-renders
- [01-03 Password Hash]: SHA-256 for Phase 1 client-only auth (flagged for backend bcrypt replacement in Phase 3)
- [01-03 Sessions]: 30-day session expiration with IndexedDB persistence across restarts

### Pending Todos

- Energy calculation formula to be defined
- Terms & conditions legal text to be written
- Neuroscience color palette to be researched and documented

### Blockers/Concerns

- PDF files from user desktop not accessible in this environment (product info may be missing)
- Energy formula weights undefined
- Groq API model selection not yet decided

## Session Continuity

Last session: 2026-02-11T13:36:24Z
Stopped at: Completed 01-03-PLAN.md (Auth Data Layer & Context)
Resume file: None
