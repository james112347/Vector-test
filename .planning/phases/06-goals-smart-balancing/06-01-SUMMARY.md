---
phase: 06-goals-smart-balancing
plan: 01
subsystem: woop-goals-ai-balancing
tags: [goals, woop, mcii, ai-wizard, energy-budget, chronotype-schedule, streaks]

dependency_graph:
  requires:
    - "04-01 (Energy engine for chronotype + energy budget)"
    - "03-01 (Check-ins for auto-tracking linked goals)"
  provides:
    - "WOOP goal framework (Wish, Outcome, Obstacle, Plan)"
    - "AI wizard for goal creation (3 modes)"
    - "Energy budget allocation and overload detection"
    - "Chronotype-based schedule optimization"
    - "Goal templates (10+ Italian)"
    - "Streak tracking and visualization"
  affects:
    - "Phase 5 (Goals widget on dashboard)"
    - "Phase 7 (Goal reminders in notifications)"

key_files:
  created:
    - path: "src/pages/Goals.tsx"
      purpose: "Full goals page: WOOP creation (3 modes), goal cards, energy budget, schedule, stats — 1100+ lines"
    - path: "src/lib/goals.ts"
      purpose: "Goal CRUD, AI advice generation, template definitions, progress calculations"
  modified:
    - path: "src/db/schema.ts"
      purpose: "Goal and GoalLog interfaces with WOOP fields, categories, streaks"

decisions:
  - decision: "MCII/WOOP framework"
    rationale: "Evidence-based (Oettingen 2012, effect size g=0.277-0.465, 2x success vs info-only)"
  - decision: "3 AI creation modes (Quick, Template, Custom)"
    rationale: "Quick for fast users, templates for inspiration, custom for full control"
  - decision: "Energy budget (60% daily allocation)"
    rationale: "Prevents overcommitment; red warning at >70%"
  - decision: "Chronotype-based scheduling"
    rationale: "Lion/bear/wolf/dolphin have different peak energy windows"
  - decision: "Linked check-in types"
    rationale: "Water goals auto-track from water check-ins; stress goals from stress check-ins"

metrics:
  files_created: 2
  completed_date: "2026-02-11"
  retroactive: true
---

# Phase 06 Plan 01: Goals & Smart Balancing — Retroactive Summary

**One-liner:** Complete WOOP goal system with AI wizard (3 modes), 10+ Italian templates, energy budget allocation, chronotype scheduling, streak tracking, and linked check-in auto-progress.

## Objective

Build the goals system with different time horizons, importance levels, and AI-driven priority balancing.

## Implementation Summary

### WOOP Goal Framework
Each goal has 4 WOOP fields:
- **Wish**: What you want to achieve
- **Outcome**: Best possible result
- **Obstacle**: Main internal obstacle
- **Plan**: If-Then implementation intention

### AI Wizard (3 modes)
1. **Quick**: Write goal → AI auto-fills WOOP + generates tips
2. **Template**: 10+ predefined goals in Italian (hydration, exercise, sleep, meditation, reading, etc.)
3. **Custom**: Manual WOOP entry with AI analysis button

### AI Analysis Outputs
- Optimal time of day
- Estimated energy cost (alto/medio/basso)
- Suggested target + unit
- Conflict detection with other goals
- Implementation tips (mini-steps)
- Improved If-Then plan
- Expected timeline
- Linked check-in suggestion

### Energy Budget System
- 60% daily energy allocated to goals
- Overload detection: red warning if allocation > 70%
- Per-goal energy cost estimation

### Chronotype Scheduling
- Optimal time windows per goal based on user's chronotype
- Lion: early morning peak; Bear: mid-morning; Wolf: evening; Dolphin: variable

### Goal Management
- Categories: energy, sleep, fitness, stress, nutrition, productivity, custom
- Timeframes: daily, weekly, monthly
- Status: active, paused, completed, abandoned
- Streak tracking (current + best)
- Goal progress logging with manual value entry
- Smart pause/resume

### Templates (Italian)
- Bere 8 bicchieri, Esercizio 30min, Dormire 8 ore, Meditazione 5min, Leggere 20min, etc.

## Verification Against Success Criteria

- [x] User can create daily, weekly, short-term, and long-term goals
- [x] Goals have priority/importance levels (energy budget allocation)
- [x] AI recommends which goals to focus on given current energy
- [x] App suggests productivity actions vs recovery actions (energy budget + schedule)
- [x] Goals interact with the energy dashboard (goals widget on dashboard)

## Cross-Cutting Integration

- **Chronotype from Phase 4**: Energy engine's chronotype detection (lion/bear/wolf/dolphin) drives optimal goal scheduling windows
- **Energy budget from Phase 4**: Uses current energy score to calculate 60% daily allocation
- **Check-in auto-progress from Phase 3**: Water check-ins auto-increment water goals, stress check-ins linked to stress goals
- **Dashboard widget in Phase 5**: Active goals count + streak display on main dashboard
- **AI analysis**: Groq API generates WOOP fields, optimal timing, energy cost, conflict detection, implementation tips

## Known Gaps

- No sub-goals or milestone tracking
- No gamification (badges, leaderboards)
- No sharing/accountability partners

## Self-Check: PASSED
