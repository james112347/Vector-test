# Phase 07 Plan 03 — Notification Preferences UI

## What was done

### Task 1: Notification preferences card in Settings
- Added imports for `getOrientationPreferences`, `updateOrientationPreferences`, and `OrientationPreferences` type
- Added state variables `notifPrefs` and `notifPrefsLoading`
- Added useEffect to load preferences on mount (keyed on `currentUser?.id`)
- Added `updateNotifPref` helper for partial preference updates with optimistic state
- Rendered "Preferenze Notifiche" Card after the Account card with:
  - **Sound toggle**: same toggle pattern as existing autoRefresh/notifications toggles
  - **Quiet hours**: native `<input type="time">` for start/end (Dalle/Alle)
  - **Frequency selector**: 3-button group (Poche/Moderate/Frequenti) for suggestionFrequency
- All changes persist immediately to IndexedDB via `updateOrientationPreferences`
- All text in Italian, matching existing Settings styling patterns

## Files modified
- `src/pages/Settings.tsx` — imports, state, useEffect, helper, notification preferences card

## Verification
- `npx tsc --noEmit` passes with zero errors
- `npm run build` completes successfully
- "Preferenze Notifiche" section present in Settings
- Sound toggle, quiet hours inputs, and frequency selector all wired to OrientationPreferences
