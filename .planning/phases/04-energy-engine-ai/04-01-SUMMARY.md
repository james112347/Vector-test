---
phase: 04-energy-engine-ai
plan: 01
subsystem: energy-calculation-ai-integration
tags: [energy-engine, groq-ai, circadian, allostatic, chronotype, predictions]

dependency_graph:
  requires:
    - "02-01 (User profile for baseline calculations)"
    - "03-01 (Daily logs + check-ins as input data)"
  provides:
    - "Scientific energy score (0-100) with 4 components"
    - "Chronotype detection (lion/bear/wolf/dolphin)"
    - "12-hour energy curve predictions"
    - "Bottleneck identification"
    - "AI-generated insights via Groq API"
    - "Personal baselines (EWMA 14-day rolling)"
  affects:
    - "Phase 5 (Dashboard displays energy scores)"
    - "Phase 6 (Goals use energy budget)"
    - "Phase 7 (Notifications triggered by energy state)"

tech_stack:
  patterns:
    - "Scientific model: Borbely Two-Process (circadian), Van Dongen (sleep debt), McEwen (allostatic load)"
    - "EWMA 14-day rolling baselines for personalization"
    - "Multiplicative interaction penalty when multiple components low"
    - "Groq API with rate-limited caching"
    - "Hybrid analysis for admin (multi-user patterns)"

key_files:
  created:
    - path: "src/lib/energy-engine.ts"
      purpose: "Scientific energy model — 4 components (circadian, sleep, lifestyle, allostatic), 0-100 scoring"
    - path: "src/lib/ai.ts"
      purpose: "Groq AI integration — quick tips, low-energy alerts, pattern detection"
    - path: "src/lib/ai-hybrid.ts"
      purpose: "Hybrid analysis engine for admin — cross-user pattern detection"
    - path: "src/lib/ml-engine.ts"
      purpose: "ML-based trend analysis (7/14/30 day windows)"
    - path: "src/components/ScientificEnergyCard.tsx"
      purpose: "UI card displaying energy score, components, chronotype, predictions"
    - path: "src/pages/Orientation.tsx"
      purpose: "Energy orientation page with activity recommendations"
  modified:
    - path: "src/db/schema.ts"
      purpose: "ScientificEnergyScore interface for persisting calculations"

decisions:
  - decision: "4-component model (circadian, sleep, lifestyle, allostatic)"
    rationale: "Each component 0-25, total 0-100. Based on peer-reviewed research"
  - decision: "Scientific constants (caffeine half-life 5h, optimal sleep 8h, hydration 33ml/kg)"
    rationale: "Evidence-based: Nehlig 2010, Ganio 2011, Van Dongen 2003"
  - decision: "Chronotype detection (lion/bear/wolf/dolphin)"
    rationale: "Breus model — maps to optimal energy windows"
  - decision: "Multiplicative interaction penalty"
    rationale: "When multiple components are low, decline is steeper than additive"
  - decision: "EWMA 14-day baselines"
    rationale: "Personalization: adapts scoring to individual patterns over time"
  - decision: "Groq API (Llama models)"
    rationale: "Fast inference, free tier available, OpenAI-compatible API"

metrics:
  files_created: 6
  completed_date: "2026-02-11"
  retroactive: true
---

# Phase 04 Plan 01: Energy Engine + AI — Retroactive Summary

**One-liner:** Complete scientific energy model (4 components, 0-100 scoring, chronotype, predictions) with Groq AI integration for personalized insights, pattern detection, and activity recommendations.

## Objective

Build the system that computes energy scores from profile + daily logs and integrates Groq AI for personalized advice and predictions.

## Implementation Summary

### Energy Engine (energy-engine.ts)
**4 Components (0-25 each, total 0-100):**

1. **Circadian (0-25)**: Borbely Two-Process Model, BRAC 90-min cycles, post-prandial dip
2. **Sleep (0-25)**: Duration vs optimal, quality, sleep debt (Van Dongen rolling 7-day), nap recovery
3. **Lifestyle (0-25)**: Hydration (Ganio 33ml/kg), nutrition quality, caffeine (Nehlig half-life=5h), activity (POMS), smoking/alcohol impact, screen time
4. **Allostatic Load (0-25)**: McEwen model, HRV proxy, stress cumulativity, burnout risk, recovery deficit, emotional drain

**Outputs (EnergyBreakdown):**
- Overall score (0-100) with interaction penalty
- 4 component scores + chronotype (lion/bear/wolf/dolphin)
- Predicted curve (next 12 hours, 6 data points)
- Top bottleneck + confidence level
- Personal baselines (EWMA 14-day)
- Adaptive component weights per user

### AI Integration (ai.ts)
- Groq API (OpenAI-compatible) for completions
- System prompt: Italian assistant, pattern detection, practical suggestions
- Quick tips: cached per day
- Low-energy alerts: triggered when average < 5
- Context includes: profile, recent logs, check-ins, Sahha scores

### Hybrid Analysis (ai-hybrid.ts)
- Admin-only: analyzes all users collectively
- Detects usage patterns, churn risk, feature adoption
- Generates system-wide insights

### ML Engine (ml-engine.ts)
- Trend analysis: 7/14/30 day windows
- Pattern recognition for behavioral trends

## Verification Against Success Criteria

- [x] Energy scores are calculated from all available data
- [x] Physical, mental, emotional, and total scores are computed separately
- [x] Segnalazioni weigh in calculations (via notes/stress data)
- [x] Groq AI generates personalized advice
- [x] AI produces predictions ("if nothing changes...")
- [x] AI alerts when energy is low or habits are harmful
- [x] Stress level and fatigue type are identified (allostatic component)

## Known Gaps

- No real HRV integration (only Sahha proxy when available)
- No menstrual cycle awareness in calculations
- No jet lag adjustment for travel
- Cortisol modeling limited (CAR mentioned but not fully implemented)
- No skin temperature input

## Self-Check: PASSED
