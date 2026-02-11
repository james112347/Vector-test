# STORY-002: Login Wall + Registration + T&C + Session

## Goal

Implement the authentication layer: a login screen that blocks all app content, a registration flow gated by Terms & Conditions acceptance, and persistent sessions.

## Acceptance Criteria

- [ ] Unauthenticated users see ONLY the login screen -- no app content visible
- [ ] Login form: email/username + password
- [ ] Registration form: email/username + password + confirm password
- [ ] Registration includes a T&C checkbox that MUST be checked to proceed
- [ ] T&C text is viewable (scrollable modal or dedicated page)
- [ ] After successful registration, user is logged in and redirected to app
- [ ] After successful login, user is redirected to app (or onboarding if first time)
- [ ] Session persists across browser restarts (token in localStorage)
- [ ] User can log out -- session cleared, login screen reappears
- [ ] Direct URL access to protected routes redirects to login
- [ ] Password is NEVER stored in plaintext

## Constraints

- AUTH-01 through AUTH-05 all satisfied
- No OAuth or social login
- Backend needed for auth (or Firebase/Supabase for rapid MVP)
- T&C text can be placeholder for now but component must work

## Files to Touch

- `src/pages/Login.*` -- login page
- `src/pages/Register.*` -- registration page with T&C
- `src/auth/` -- auth module (session management, route guards)
- `src/components/TermsModal.*` -- T&C display component
- Backend auth setup (endpoint or service)

## Test Plan

- [ ] Open app in incognito -- login screen only, no content leaks
- [ ] Register without checking T&C -- blocked
- [ ] Register with T&C checked -- account created, redirected
- [ ] Close browser, reopen -- still logged in
- [ ] Logout -- back to login screen
- [ ] Navigate to `/dashboard` directly while logged out -- redirected to login

## Notes

Depends on STORY-001. Backend choice (custom API, Firebase, Supabase) to be decided during planning.
