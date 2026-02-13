---
phase: 01-pwa-shell-auth-design-system
plan: 04
subsystem: auth-ui-routing
tags: [auth-pages, routing, app-shell, login, register, terms, protected-routes]

dependency_graph:
  requires:
    - "01-02 (Design system + shadcn/ui components)"
    - "01-03 (Auth context + Dexie database)"
  provides:
    - "Login page with email/password auth and error handling"
    - "Register page with T&C checkbox (GDPR compliant)"
    - "Terms and Conditions page with comprehensive Italian legal text"
    - "Protected routing with onboarding gate"
    - "AppShell layout with Header (dark mode + logout) and BottomNav"
    - "Dashboard with admin widgets, check-ins, energy card, goals"
  affects:
    - "All future phases (routes added to router.tsx)"

tech_stack:
  added:
    - library: react-router-dom
      purpose: "Client-side routing with protected routes"
    - library: lucide-react
      purpose: "Icons for Header (Moon, Sun, LogOut, User)"
  patterns:
    - "ProtectedRoute with Outlet pattern for nested auth-guarded routes"
    - "Onboarding gate inside ProtectedRoute (shows onboarding if no profile)"
    - "AppShell wraps all authenticated pages (Header + BottomNav + Outlet)"
    - "Pending approval flow (non-admin users await admin approval)"

key_files:
  created:
    - path: "src/pages/Login.tsx"
      purpose: "Login form with email/password, forgot password mode, connection error handling, pending approval UI"
    - path: "src/pages/Register.tsx"
      purpose: "Registration form with T&C checkbox (unchecked by default, GDPR), inline terms preview, pending approval result"
    - path: "src/pages/Terms.tsx"
      purpose: "Full Terms and Conditions page in Italian with privacy, data collection, user rights sections"
    - path: "src/pages/Dashboard.tsx"
      purpose: "Main dashboard with admin stats, quick check-ins, energy card, orientation, goals, insights"
    - path: "src/routes/ProtectedRoute.tsx"
      purpose: "Auth guard redirecting unauthenticated users to /login, with onboarding gate"
    - path: "src/routes/router.tsx"
      purpose: "React Router v7 configuration with public routes (login, register, terms) and protected routes"
    - path: "src/components/layout/AppShell.tsx"
      purpose: "Main layout with Header, BottomNav, feedback FAB, and various auto-sync hooks"
    - path: "src/components/layout/Header.tsx"
      purpose: "Sticky header with Vector logo, profile dropdown, dark mode toggle, logout button"
  modified:
    - path: "src/App.tsx"
      purpose: "Wraps AuthProvider around RouterProvider"

decisions:
  - decision: "Italian localization for all auth UI"
    rationale: "Target user base is Italian-speaking"
  - decision: "Pending approval flow for non-admin registrations"
    rationale: "Admin must approve new users for controlled access"
  - decision: "Onboarding gate inside ProtectedRoute"
    rationale: "New users complete profile before seeing dashboard"
  - decision: "basename '/Vector-test' in router"
    rationale: "App deployed under /Vector-test path on GitHub Pages"

metrics:
  tasks_completed: 2
  files_created: 8
  completed_date: "2026-02-11"
---

# Phase 01 Plan 04: Auth Pages, App Shell, Routing Summary

**One-liner:** Complete auth UI flow (Login, Register with GDPR T&C, Terms page), protected routing with onboarding gate, AppShell layout with Header/BottomNav, and integrated Dashboard.

## Objective

Build the auth UI flow (Login, Register with T&C, Terms page), the protected routing system, the app shell layout with header and navigation, and integrate everything into App.tsx.

## Implementation Summary

### Task 1: Auth Pages (Login, Register, Terms)

**Login page** (`src/pages/Login.tsx`):
- Email/password form using Card, Input, Button, Label components
- Loading state during sign-in
- Error handling: invalid credentials, connection errors, pending approval
- "Forgot password" mode with admin contact instructions
- Link to /register for new users
- Mobile-first layout (min-h-[100dvh], max-w-md)

**Register page** (`src/pages/Register.tsx`):
- Email, password, confirm password fields
- T&C Checkbox: unchecked by default (GDPR compliant)
- Registration button disabled until checkbox checked
- Inline expandable T&C preview + link to full /terms page
- Post-registration: shows pending approval message for non-admin users
- Password validation: minimum 8 characters, must match confirmation

**Terms page** (`src/pages/Terms.tsx`):
- Comprehensive Italian T&C with sections: Terms of Service, Privacy, Data Collection, Sync/Multi-device, Admin Data Access, User Rights, Third-party Services
- Detailed data collection disclosure (profile, daily logs, wearable data)
- Navigation context-aware (back to register or settings)

### Task 2: App Shell, Routing, Integration

**ProtectedRoute** (`src/routes/ProtectedRoute.tsx`):
- Checks `isSignedIn` via `useAuthState()`
- Redirects to /login if not authenticated
- Redirects if user not approved
- Shows Onboarding if no user profile exists

**Router** (`src/routes/router.tsx`):
- Public routes: /login, /register, /terms
- Protected routes wrapped in ProtectedRoute > AppShell
- Routes: /, /log, /history, /health, /settings, /profile, /admin, /feedback, /orientation, /goals, /insights

**AppShell** (`src/components/layout/AppShell.tsx`):
- Header + main content (Outlet) + BottomNav
- Feedback chat FAB with rotating tooltip messages
- Auto-sync hooks (Sahha, admin notifications, activity tracking)

**Header** (`src/components/layout/Header.tsx`):
- "Vector BETA" logo with navigation to /
- Profile dropdown with user info
- Dark mode toggle (Sun/Moon icons via useDarkMode hook)
- Logout button

**App.tsx**: AuthProvider wraps RouterProvider

## Deviations from Plan

- **Enhanced beyond plan**: Login includes forgot password mode and connection error handling
- **Enhanced beyond plan**: Register includes inline T&C preview and pending approval flow
- **Enhanced beyond plan**: Terms page is comprehensive Italian legal text (not placeholder)
- **Enhanced beyond plan**: ProtectedRoute includes onboarding gate
- **Enhanced beyond plan**: AppShell includes BottomNav, feedback FAB, auto-sync hooks
- **Enhanced beyond plan**: Dashboard is fully featured (not placeholder)

## Verification Results

- [x] `npm run build` succeeds (1938 modules, 10.17s)
- [x] Login page authenticates via AuthContext with error handling
- [x] Register page enforces T&C acceptance (checkbox unchecked by default, button disabled)
- [x] Terms page shows comprehensive Italian legal text
- [x] Protected routing redirects unauthenticated users to /login
- [x] AppShell wraps authenticated pages with Header and BottomNav
- [x] Dark mode toggle works via useDarkMode hook
- [x] Logout clears session and redirects to /login
- [x] All pages use shadcn/ui components and design tokens

## Phase 1 Success Criteria: ALL MET

1. User can install the app on phone's home screen (PWA manifest + service worker)
2. App shows login wall -- no content visible without authentication
3. New user must accept T&C before registration completes
4. User session persists after closing and reopening the app
5. App shell loads even when offline (service worker precaching)
6. Dark mode toggle works and preference is saved
7. Design follows neuroscience color principles (documented in theme.css)

## Self-Check: PASSED

All claimed artifacts verified to exist in codebase.
