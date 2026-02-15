# Phase 07 Plan 02 — SmartHabitPrompt + Check-in Reminders

## What was done

### Task 1: SmartHabitPrompt integrated into Dashboard
- Imported `SmartHabitPrompt` component in `Dashboard.tsx`
- Rendered `<SmartHabitPrompt userId={user.id} />` after QuickCheckins and before the "Cosa fare adesso" orientation card
- Component shows habit-pattern-based notification cards with quick response buttons
- Returns null when no notifications exist (no visual impact when empty)

### Task 2: Check-in reminder system
- Created `src/lib/checkin-reminders.ts` with `scheduleCheckinReminders(userId)` function
- Analyzes habit patterns via `analyzeHabitPatterns()` from habit-intelligence
- For regular/very_regular patterns with typical times in the next 60 minutes, schedules browser notifications via `setTimeout`
- Respects quiet hours from OrientationPreferences
- 10-minute debounce via localStorage to avoid re-scheduling on rapid re-renders
- Active timer tracking to prevent duplicate notifications
- Tagged notifications (`checkin-reminder-{type}`) prevent browser-level duplicates
- Exported `TYPE_LABELS` from `habit-intelligence.ts` for shared label access
- Dashboard calls `scheduleCheckinReminders(uid)` in loadData after data loads

## Files modified
- `src/pages/Dashboard.tsx` — import SmartHabitPrompt + scheduleCheckinReminders, render component, call reminders
- `src/lib/checkin-reminders.ts` — NEW: scheduled check-in reminder system
- `src/lib/habit-intelligence.ts` — exported TYPE_LABELS

## Verification
- `npx tsc --noEmit` passes with zero errors
- `npm run build` completes successfully
- SmartHabitPrompt imported and rendered in Dashboard
- scheduleCheckinReminders called in Dashboard loadData
