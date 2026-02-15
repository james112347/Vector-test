---
phase: 07-notifications-learning
plan: 01
subsystem: notifications-feedback-learning
tags: [notifications, pwa-notifications, feedback-chat, screen-time, habit-intelligence, smart-prompts]

dependency_graph:
  requires:
    - "04-01 (Energy engine for alert triggers)"
    - "06-01 (Goals for reminder context)"
    - "03-01 (Check-ins for habit pattern analysis)"
  provides:
    - "PWA browser notifications (Notification API + Service Worker)"
    - "App badge (navigator.setAppBadge)"
    - "Sound alerts (Web Audio API)"
    - "Habit intelligence system (14-day pattern analysis, smart notifications)"
    - "SmartHabitPrompt component (quick-response UI)"
    - "Feedback chat system (AI-assisted, multi-turn)"
    - "Screen time auto-tracking"
    - "Admin notification system"
    - "Energy orientation notification manager"
  affects:
    - "Phase 8 (Admin receives feedback notifications)"
    - "Phase 5 (Dashboard notification banner + SmartHabitPrompt integration pending)"

tech_stack:
  patterns:
    - "Notification API + Service Worker for browser push"
    - "Web Audio API for sound alerts (gentle/alert tones)"
    - "navigator.setAppBadge for PWA unread count"
    - "14-day EWMA pattern analysis with time clustering"
    - "Session-level cache with 1-hour TTL for habit analysis"
    - "Image compression (max 800px) for feedback attachments"

key_files:
  created:
    - path: "src/lib/notifications.ts"
      purpose: "PWA notification system — Notification API, service worker push, app badge"
    - path: "src/lib/energy-orientation/notification-manager.ts"
      purpose: "Energy orientation alerts with sound config, suggestion/alert tones"
    - path: "src/lib/habit-intelligence.ts"
      purpose: "FULLY IMPLEMENTED (344 lines) — habit pattern analysis, time clustering, regularity scoring, energy correlation, smart notification generation"
    - path: "src/components/SmartHabitPrompt.tsx"
      purpose: "FULLY IMPLEMENTED (88 lines) — displays smart notifications, quick-response buttons, dismiss, priority-based styling"
    - path: "src/components/NotificationPrompt.tsx"
      purpose: "Permission prompt component for browser notifications"
    - path: "src/pages/FeedbackChat.tsx"
      purpose: "Multi-turn AI-assisted feedback chat with image/video attachments (607 lines)"
    - path: "src/lib/feedback.ts"
      purpose: "Feedback CRUD, AI categorization, attachment handling"
    - path: "src/lib/useScreenTime.ts"
      purpose: "Screen time auto-tracking hook (minutes, sessions, longest session)"
    - path: "src/lib/useAdminNotifications.ts"
      purpose: "Admin notification hook for new feedback alerts"
  modified:
    - path: "src/db/schema.ts"
      purpose: "UserFeedback, ScreenTimeLog interfaces"

decisions:
  - decision: "Browser notifications (not Firebase)"
    rationale: "PWA-native approach, no external dependency, works in Chrome/Edge"
  - decision: "Web Audio API for sounds"
    rationale: "Gentle tones for suggestions, alert tones for warnings"
  - decision: "AI-assisted feedback chat"
    rationale: "Groq categorizes feedback, helps user articulate issues"
  - decision: "Image compression (max 800px)"
    rationale: "Reduce attachment size for IndexedDB storage"
  - decision: "Screen time auto-tracking"
    rationale: "Passive tracking without user effort, contributes to lifestyle score"
  - decision: "14-day analysis window for habit patterns"
    rationale: "Long enough to detect patterns, short enough to adapt to changes"
  - decision: "Session-level cache (1h TTL) for habit analysis"
    rationale: "Avoid expensive DB queries on every render"

metrics:
  files_created: 9
  completed_date: "2026-02-11"
  retroactive: true
---

# Phase 07 Plan 01: Notifications + Learning System — Retroactive Summary

**One-liner:** PWA notification system (browser + service worker + sound), fully implemented habit intelligence (14-day pattern analysis + smart notification generation), AI-assisted feedback chat with attachments, screen time tracking, admin alerts.

## Objective

Build smart notifications with logical timing, the habit intelligence system that learns user patterns and generates context-aware prompts, feedback system, and screen time tracking.

## Implementation Summary

### Notification System
- **Browser Notifications**: Notification API with permission prompt
- **Service Worker**: `reg.showNotification()` for background alerts
- **App Badge**: `navigator.setAppBadge()` for Chrome PWA unread count
- **Sound**: Web Audio API — gentle tone for suggestions, alert for warnings

### Notification Types
1. **New Feedback Alert** (admin): when user submits feedback
2. **Feedback Reply** (user): when admin replies
3. **Orientation Alerts**: energy dip warnings, crash predictions
4. **Suggestion Notifications**: recommendations with reasoning

### Habit Intelligence (FULLY IMPLEMENTED — 344 lines)
**`analyzeHabitPatterns(userId)`:**
- Analyzes 14 days of check-in data
- Detects typical times when habits occur (time clustering)
- Calculates average daily frequency per habit
- Identifies peak days of the week
- Regularity scoring: very_regular, regular, irregular
- Energy correlation analysis: positive, negative, none
- Trend detection: increasing, decreasing, stable
- Session-level caching with 1-hour TTL

**`generateSmartNotifications(userId)`:**
- Creates context-aware notifications based on user patterns
- Detects optimal times to ask for check-ins
- Generates quick-response options for rapid feedback
- Special logic for counters (caffeine, water) vs scales (mood, stress)
- Prevents notification spam with deduplication
- Prioritizes by energy correlation and time-sensitivity
- Returns typed `SmartNotification[]` with priority levels (high/medium/low)

### SmartHabitPrompt Component (FULLY IMPLEMENTED — 88 lines)
- Displays smart in-app notifications based on habit patterns
- Refreshes every 15 minutes
- Priority-based visual styling (high = primary, medium = amber, low = card)
- Quick response buttons — user responds with one tap to add check-in
- Dismiss button with local state to prevent re-showing
- Bell icon from lucide-react, smooth animations (fade-in, slide-in-from-top)
- **NOTE: Component exists but is NOT yet rendered in Dashboard.tsx** (planned in 07-02)

### Feedback System (FeedbackChat — 607 lines)
- Multi-turn chat interface
- AI assistant (Groq) helps categorize and formulate feedback
- Attachments: image (compressed to max 800px) + video (max 8MB)
- Categories: bug, feature, improvement, support, other
- Status tracking: draft → sent → read
- Admin replies persist in UserFeedback.adminReply

### Screen Time Tracking
- Auto-tracked via useScreenTime hook
- Metrics: daily minutes, session count, longest session
- Displayed in ScreenTimeCard component
- Feeds into lifestyle component of energy engine

### Admin Notifications
- useAdminNotifications hook polls for new feedback
- Unread count badge on admin panel
- Priority sorting by timestamp

## Verification Against Success Criteria

- [x] Notifications fire at logical times (orientation alerts based on energy state)
- [x] Notifications request specific feedback to update predictions (feedback chat system)
- [x] App tracks behavior frequencies over time (habit intelligence + screen time + check-in history)
- [x] Historical data is preserved and trends are viewable (DailyHistory, Insights, History)
- [x] Habit intelligence learns user routine (14-day pattern analysis, time clustering, regularity scoring)
- [x] Smart notification generation creates context-aware prompts (optimal times, quick-response, spam prevention)

## Remaining Gaps (3 moderate)

1. **SmartHabitPrompt not wired to Dashboard**: Component fully built (88 lines) but not rendered — planned in 07-02-PLAN.md
2. **Scheduled check-in reminders**: No time-based reminder system — planned in 07-02-PLAN.md
3. **Notification preferences UI**: No settings for sound, quiet hours, frequency — planned in 07-03-PLAN.md

## Self-Check: PASSED (core system complete, 3 moderate integration gaps remain)
