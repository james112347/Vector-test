---
phase: 07-notifications-learning
plan: 01
subsystem: notifications-feedback-learning
tags: [notifications, pwa-notifications, feedback-chat, screen-time, habit-intelligence]

dependency_graph:
  requires:
    - "04-01 (Energy engine for alert triggers)"
    - "06-01 (Goals for reminder context)"
  provides:
    - "PWA browser notifications (Notification API + Service Worker)"
    - "App badge (navigator.setAppBadge)"
    - "Sound alerts (Web Audio API)"
    - "Feedback chat system (AI-assisted, multi-turn)"
    - "Screen time auto-tracking"
    - "Admin notification system"
    - "Energy orientation notification manager"
  affects:
    - "Phase 8 (Admin receives feedback notifications)"
    - "Phase 5 (Dashboard notification banner)"

key_files:
  created:
    - path: "src/lib/notifications.ts"
      purpose: "PWA notification system — Notification API, service worker push, app badge"
    - path: "src/lib/energy-orientation/notification-manager.ts"
      purpose: "Energy orientation alerts with sound config, suggestion/alert tones"
    - path: "src/lib/habit-intelligence.ts"
      purpose: "Habit learning system — SKELETON ONLY, stubs for future implementation"
    - path: "src/components/NotificationPrompt.tsx"
      purpose: "Permission prompt component for browser notifications"
    - path: "src/pages/FeedbackChat.tsx"
      purpose: "Multi-turn AI-assisted feedback chat with image/video attachments"
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

metrics:
  files_created: 8
  completed_date: "2026-02-11"
  retroactive: true
---

# Phase 07 Plan 01: Notifications + Learning System — Retroactive Summary

**One-liner:** PWA notification system (browser + service worker + sound), AI-assisted feedback chat with attachments, screen time tracking, admin alerts — habit learning skeleton only.

## Objective

Build smart notifications with logical timing, feedback system, and the learning system that improves predictions by studying user routine.

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

### Feedback System (FeedbackChat)
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

### Habit Intelligence (INCOMPLETE)
- `habit-intelligence.ts` exists but contains **skeleton/stubs only**
- No actual habit pattern detection
- No behavioral reinforcement tracking
- No streak-based habit formation

## Verification Against Success Criteria

- [x] Notifications fire at logical times (orientation alerts based on energy state)
- [x] Notifications request specific feedback to update predictions (feedback chat system)
- [x] App tracks behavior frequencies over time (screen time + check-in history)
- [x] Historical data is preserved and trends are viewable (DailyHistory, Insights)
- [ ] **PARTIAL**: Predictions improve as the app learns routine (EWMA baselines exist but habit-intelligence is skeleton)

## Known Gaps — CRITICAL

1. **Habit Intelligence**: `habit-intelligence.ts` is empty stubs — no real habit learning
2. **No scheduled reminders**: no time-based check-in prompts
3. **No push notifications**: only in-browser (no Firebase/FCM)
4. **No timezone-aware timing**: times are local without explicit timezone
5. **No negative feedback handling**: no snooze, "not relevant", dismiss options

## Self-Check: PARTIAL — Habit learning not implemented
