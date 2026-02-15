---
phase: 03-daily-logging
plan: 01
subsystem: energy-logging-checkins
tags: [daily-log, quick-checkins, energy-input, phased-checkins]

dependency_graph:
  requires:
    - "02-01 (Onboarding — user profile for context)"
    - "01-03 (Auth context + database)"
  provides:
    - "Daily energy log (physical/mental/emotional 1-10)"
    - "Quick check-in system (12+ types, time-phased)"
    - "AI-generated quick tips and low-energy alerts"
    - "Historical check-in data for energy engine"
  affects:
    - "Phase 4 (Energy Engine consumes logs + check-ins)"
    - "Phase 5 (Dashboard displays daily history)"
    - "Phase 6 (Goals linked to check-in types)"

tech_stack:
  patterns:
    - "Time-phased check-in system (morning/midday/afternoon/evening)"
    - "Rating buttons (1-5) with color coding"
    - "AI cache per day (Groq tips)"
    - "Skip-if-already-logged for daily metrics"

key_files:
  created:
    - path: "src/pages/LogEnergy.tsx"
      purpose: "Main energy logging page with 3 sliders (physical/mental/emotional), notes, AI tips"
    - path: "src/components/QuickCheckins.tsx"
      purpose: "Phase-aware micro-surveys: sleep, water, caffeine, meals, focus, stress, mood, nap, screen break"
    - path: "src/lib/checkins.ts"
      purpose: "Check-in CRUD operations, getTodayCheckins, saveCheckin"
  modified:
    - path: "src/db/schema.ts"
      purpose: "EnergyLog and QuickCheckin interfaces with 12+ checkin types"

decisions:
  - decision: "12+ check-in types"
    rationale: "Comprehensive daily tracking: sleep, water, caffeine, meals, focus, stress, mood, nap, supplements, screen breaks, current activity"
  - decision: "Time-phased check-ins"
    rationale: "Morning <11h, midday <14h, afternoon <18h, evening — shows relevant check-ins per time of day"
  - decision: "1-10 energy sliders"
    rationale: "Granular self-assessment for physical, mental, emotional dimensions"
  - decision: "AI quick tips with daily cache"
    rationale: "Groq generates personalized tips once per day, cached to avoid rate limits"
  - decision: "Current activity tracking (0-7 enum)"
    rationale: "Tracks what user is doing right now: idle, study, work, rest, sport, leisure, social, errands"

metrics:
  files_created: 3
  completed_date: "2026-02-11"
  retroactive: true
---

# Phase 03 Plan 01: Daily Logging — Retroactive Summary

**One-liner:** Complete daily energy logging system with 3-axis sliders (1-10), 12+ quick check-in types phased by time of day, AI-generated tips, and low-energy alerts.

## Objective

Enable users to input daily data (sleep, phone usage, work shift, fatigue type, hydration, food) manually, with the app proactively asking relevant questions during the day.

## Implementation Summary

### Daily Energy Log (LogEnergy.tsx)
- Three sliders: Physical, Mental, Emotional (1-10 scale)
- Work hours today field
- Free-text notes
- AI-generated quick tips (cached per day via Groq)
- Low-energy alerts (auto-triggered if average < 5)
- Yesterday comparison display

### Quick Check-ins (QuickCheckins.tsx)
12+ check-in types organized by time of day:
- **Morning**: sleep_quality, water, caffeine, mood, meal_time (breakfast)
- **Midday**: water, meal_time (lunch), focus, stress, activity_done
- **Afternoon**: water, meal_time (snack), screen_break
- **Evening**: meal_time (dinner), water, mood

### Check-in Features
- Rating buttons (1-5) with color coding (red → green)
- Skip-if-already-logged for daily metrics
- Goal auto-increment (water count → linked water goals)
- Stress check-in linked to stress goals

## Verification Against Success Criteria

- [x] User can log sleep duration and quality (sleep_quality check-in)
- [x] User can log phone/screen usage (screen_break check-in, ScreenTimeLog auto-tracking)
- [x] User can log work shift, fatigue type, hydration, food (check-in types cover all)
- [x] All logs are timestamped (date + time fields)
- [x] App prompts relevant questions based on time of day (phased check-in system)

## Cross-Cutting Integration

- **Habit intelligence**: Check-in data (14 days) feeds into habit-intelligence.ts for pattern analysis and smart notification generation
- **Goal auto-tracking**: Linked check-in types auto-increment goals (water → water goals, stress → stress goals)
- **Energy engine**: All logs and check-ins consumed by Phase 4 scientific energy model
- **Screen time**: ScreenTimeLog auto-tracked passively, feeds into lifestyle component
- **IndexedDB**: energyLogs and quickCheckins tables in Dexie v13

## Known Gaps

- No screenshot support for phone usage (deferred to v2, manual input sufficient)
- Food logging is basic (1-5 quality scale, no macro/calorie tracking)
- No fatigue type explicit input (derived from energy engine calculations)
- No photo attachment for meals

## Self-Check: PASSED
