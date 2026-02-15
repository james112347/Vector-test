---
phase: 05-dashboard-visualization
plan: 01
subsystem: dashboard-energy-display
tags: [dashboard, energy-card, daily-history, admin-widgets, orientation]

dependency_graph:
  requires:
    - "04-01 (Energy engine for scores and predictions)"
    - "03-01 (Daily logs and check-ins for history)"
  provides:
    - "Main dashboard with time-aware greeting"
    - "Admin stats widgets (users, feedback, sessions)"
    - "Quick check-in integration on dashboard"
    - "Energy orientation recommendations"
    - "Daily history (7-day mini-charts)"
    - "Goals widget summary"
  affects:
    - "Phase 6 (Goals widget on dashboard)"
    - "Phase 7 (Notification prompts on dashboard)"

key_files:
  created:
    - path: "src/pages/Dashboard.tsx"
      purpose: "Main dashboard: greeting, admin widgets, check-ins, orientation, goals, history"
    - path: "src/components/DailyHistory.tsx"
      purpose: "Weekly energy history with mini-charts and yesterday comparison"
    - path: "src/components/ScreenTimeCard.tsx"
      purpose: "App usage tracking display card"
  modified:
    - path: "src/pages/Insights.tsx"
      purpose: "Insights page linked from dashboard (appears after 3+ days of data)"

decisions:
  - decision: "Time-aware greeting"
    rationale: "Buongiorno/Buon pomeriggio/Buonasera based on current hour"
  - decision: "Admin widgets at top"
    rationale: "Admin sees pending approvals + system stats before personal data"
  - decision: "Energy orientation integration"
    rationale: "'Cosa fare adesso' shows top recommendation from orientation engine"
  - decision: "Intelligence link after 3 days"
    rationale: "Insights page needs minimum data to be useful"

metrics:
  files_created: 3
  completed_date: "2026-02-11"
  retroactive: true
---

# Phase 05 Plan 01: Dashboard & Visualization — Retroactive Summary

**One-liner:** Complete dashboard with time-aware Italian greeting, admin stats, quick check-ins, energy orientation recommendations, goals widget, daily history, and insights link.

## Objective

Build the dashboard that shows energy scores, predictions, trends, and personalized advice.

## Implementation Summary

### Dashboard Layout (Dashboard.tsx)
1. **Greeting**: Time-aware (Buongiorno <12h, Buon pomeriggio <18h, Buonasera)
2. **Admin Widgets** (isAdmin only): Pending approvals counter, stats grid (users, feedback, sessions, active today)
3. **Quick Check-ins**: Phase-based micro-surveys embedded in dashboard
4. **"Cosa fare adesso"**: Top recommendation from Energy Orientation system with reasoning
5. **Goals Widget**: Active goals count, top streak display
6. **Daily History**: Last 7 days energy logs with mini-charts
7. **Intelligence Link**: Links to Insights page (shows after 3+ days of data)

### Supporting Components
- **DailyHistory**: Weekly view of energy logs with per-day breakdown and yesterday comparison
- **ScreenTimeCard**: Auto-tracked app usage display (minutes, sessions, longest session)
- **Admin notification banner**: Amber banner for pending user approvals

### Features
- Auto-refresh on visibility change (when autoRefresh enabled)
- Admin stats: getAllUsers, getAllUserActivity, getUnreadFeedbackCount
- Notification banner for pending approvals
- Energy orientation with activity recommendations

## Verification Against Success Criteria

- [x] Dashboard shows total + individual energy scores with visual indicators
- [x] Predictions and trends are displayed (DailyHistory + orientation recommendations)
- [x] Personalized advice and alerts are visible (orientation "Cosa fare adesso")
- [x] User can see accumulated stress (allostatic score in energy card)
- [x] Information is educational (orientation explains why recommendations are given)

## Cross-Cutting Integration

- **Energy orientation**: useEnergyOrientation() hook provides "Cosa fare adesso" recommendations with reasoning
- **Goals widget**: Shows active goals count and streaks from Phase 6
- **Quick check-ins**: Phase 3 QuickCheckins component embedded directly
- **Admin stats**: Fetches from Phase 8 admin functions (getAllUsers, getUnreadFeedbackCount, getAllUserActivity)
- **Insights link**: Connects to AI-powered Insights page (426 lines) after 3+ days of data
- **Auto-refresh**: Dashboard refreshes data on visibility change

## Known Gaps

- No calendar view of energy scores (deferred to v2, VIS-01)
- No weekly summary card (deferred to v2, VIS-02)
- SmartHabitPrompt component not yet rendered in dashboard (planned in 07-02)
- No prediction crash warnings shown on dashboard

## Self-Check: PASSED
