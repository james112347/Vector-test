---
phase: 02-onboarding-questionnaire
plan: 01
subsystem: onboarding-form
tags: [onboarding, user-profile, multi-step-form, lifestyle-data]

dependency_graph:
  requires:
    - "01-03 (Auth context + Dexie database)"
    - "01-02 (Design system + shadcn/ui)"
  provides:
    - "4-step onboarding questionnaire (Italian)"
    - "UserProfile schema in IndexedDB"
    - "Profile edit mode via initialProfile prop"
    - "Supabase cross-device sync on save"
  affects:
    - "Phase 4 (Energy Engine uses profile for calculations)"
    - "Phase 6 (Goals linked to profile goal)"

tech_stack:
  patterns:
    - "Multi-step form with stepper progress bar"
    - "ChipGroup and OptionButton reusable UI components"
    - "Conditional field visibility (occupation-dependent)"
    - "Time inputs for circadian rhythm data (HH:MM)"
    - "IndexedDB upsert pattern (check existing, update or add)"

key_files:
  created:
    - path: "src/pages/Onboarding.tsx"
      purpose: "4-step onboarding form collecting personal data, occupation, habits, and goals"
    - path: "src/pages/ProfileEdit.tsx"
      purpose: "Profile editing page that re-uses Onboarding with editMode=true"
  modified:
    - path: "src/db/schema.ts"
      purpose: "UserProfile interface with 30+ fields for lifestyle data"
    - path: "src/routes/ProtectedRoute.tsx"
      purpose: "Onboarding gate — shows onboarding if no profile exists"

decisions:
  - decision: "4-step form structure"
    rationale: "Logical grouping: personal → occupation → habits → goals"
  - decision: "Conditional field visibility"
    rationale: "Work fields hidden for unemployed/retired users"
  - decision: "Time inputs for daily routine"
    rationale: "Circadian rhythm calculation needs wake/bed/work/meal times"
  - decision: "Goal selection at end"
    rationale: "User selects primary goal to guide AI recommendations"

metrics:
  files_created: 2
  completed_date: "2026-02-11"
  retroactive: true
---

# Phase 02 Plan 01: Onboarding Questionnaire — Retroactive Summary

**One-liner:** Complete 4-step onboarding form collecting personal data, occupation, habits/routine, and goals — all in Italian with edit mode and Supabase sync.

## Objective

Build a multi-step onboarding form that collects all lifestyle data needed for energy calculation and AI personalization.

## Implementation Summary

### Step 1: Dati personali
- Name, birth year, gender (4 options), height (cm), weight (kg)
- Validation: name ≥ 2 chars, year 1920-2010, height 100-250, weight 30-300

### Step 2: Occupazione
- Occupation type (student/worker/student_worker/unemployed/retired)
- Conditional fields: work type (free text), effort type (mental/physical/mixed/creative/social)
- Daily work hours, work schedule (regular/shifts/flexible/irregular)

### Step 3: Abitudini e routine
- Activity level (sedentary → very active)
- Sleep hours, smoking frequency, alcohol frequency, caffeine daily
- **Circadian routine times**: wake, bed, work start/end, lunch, dinner, exercise time
- All times in HH:MM format for energy engine calculations

### Step 4: Obiettivi
- Primary goal selection (more_energy, better_sleep, fitness, stress, general_wellness)
- Optional notes (medical conditions, intolerances, specific goals)

### Architecture
- **Edit mode**: `initialProfile` prop pre-fills form for profile editing
- **Supabase sync**: `pushDataToSupabase()` called on save for cross-device
- **IndexedDB upsert**: checks for existing profile, updates or creates
- **Progress bar**: visual stepper showing current step

## Verification Against Success Criteria

- [x] New user is prompted to complete onboarding after first login (ProtectedRoute gate)
- [x] Form collects: age, weight, student/worker status, work type, schedule, aspirations, vices
- [x] Multi-step form with progress indicator and back navigation
- [x] User can edit their profile after initial onboarding (ProfileEdit page)
- [x] All collected data is persisted (IndexedDB + Supabase sync)

## Known Gaps

- No photo/avatar upload
- No real-time field validation feedback (only step-level canNext)
- No "segnalazioni" field in onboarding (available as notes)
- No aspirations field (mapped to goal selection)

## Self-Check: PASSED
