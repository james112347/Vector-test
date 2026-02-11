# STORY-003: Onboarding Questionnaire

## Goal

After first login, present a multi-step onboarding form that collects all lifestyle data needed for energy calculation. Beautiful, minimal, mobile-first design with neuroscience colors.

## Acceptance Criteria

- [ ] First-time user is redirected to onboarding after login
- [ ] Multi-step form with visual progress indicator
- [ ] Step 1: Age and weight (numeric inputs with validation)
- [ ] Step 2: Status -- student / worker / other (selection)
- [ ] Step 3: Work type / profession (text input with common suggestions)
- [ ] Step 4: Work schedule / typical hours (time pickers or presets)
- [ ] Step 5: Aspirations -- "Che persona vuoi diventare?" (free text)
- [ ] Step 6: Vices / bad habits (multi-select + custom add)
- [ ] Step 7: Segnalazioni -- special flags with free-text explanation and importance indicator
- [ ] User can navigate back to previous steps
- [ ] Partial progress saved (resume if app closed mid-form)
- [ ] After completion, user lands on main dashboard
- [ ] Returning users who completed onboarding skip it
- [ ] Profile edit page allows changes post-onboarding (ONB-08)

## Constraints

- ONB-01 through ONB-08 satisfied
- No energy calculation here -- just data collection
- Design must follow neuroscience color system from STORY-001
- Mobile-first, thumb-friendly inputs

## Files to Touch

- `src/pages/Onboarding.*` -- multi-step container
- `src/components/onboarding/StepBasicInfo.*` -- age, weight
- `src/components/onboarding/StepStatus.*` -- student/worker
- `src/components/onboarding/StepWorkType.*` -- profession
- `src/components/onboarding/StepSchedule.*` -- hours
- `src/components/onboarding/StepAspirations.*` -- goals
- `src/components/onboarding/StepVices.*` -- bad habits
- `src/components/onboarding/StepFlags.*` -- segnalazioni
- `src/pages/ProfileEdit.*` -- edit profile post-onboarding
- `src/models/UserProfile.*` -- data model

## Test Plan

- [ ] New user after login -> redirected to onboarding
- [ ] Each step renders correct fields
- [ ] Forward + backward navigation works
- [ ] Submitting saves all data to backend
- [ ] Returning user is NOT shown onboarding again
- [ ] Close app mid-form, reopen -> progress preserved
- [ ] Profile edit page loads with saved data

## Notes

Depends on STORY-002 (auth). This completes Phase 2.
