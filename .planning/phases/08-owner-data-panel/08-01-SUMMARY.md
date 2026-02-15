---
phase: 08-owner-data-panel
plan: 01
subsystem: admin-dashboard-data-access
tags: [admin, user-management, feedback-management, hybrid-analysis, data-access]

dependency_graph:
  requires:
    - "07-01 (Feedback system for admin management)"
    - "04-01 (Energy engine for hybrid analysis)"
    - "01-03 (Auth context for admin role)"
  provides:
    - "Admin dashboard with user management"
    - "Feedback management (view, reply, delete)"
    - "User approval workflow"
    - "Hybrid AI analysis (cross-user patterns)"
    - "System-wide statistics"
    - "Per-user data drill-down"
  affects:
    - "All phases (admin can view all user data)"

key_files:
  created:
    - path: "src/pages/AdminDashboard.tsx"
      purpose: "Admin dashboard — user management, feedback, stats, hybrid analysis — 900+ lines"
    - path: "src/pages/Settings.tsx"
      purpose: "Settings page with admin user approval tab (300+ lines)"
  modified:
    - path: "src/lib/auth.ts"
      purpose: "Admin functions: getAllUsers, approveUser, revokeUser, deleteUser, resetPassword"
    - path: "src/lib/ai-hybrid.ts"
      purpose: "HybridAnalysis for admin — cross-user pattern detection, churn risk"

decisions:
  - decision: "Admin approval workflow"
    rationale: "Controlled access: new users need admin approval before using app"
  - decision: "Hybrid AI analysis"
    rationale: "System-wide Groq analysis of all user data for admin insights"
  - decision: "Feedback management in admin panel"
    rationale: "Centralized view of all user feedback with reply capability"
  - decision: "Per-user data drill-down"
    rationale: "Admin can expand user card to see recent logs, Sahha scores, biomarkers"

metrics:
  files_created: 2
  completed_date: "2026-02-11"
  retroactive: true
---

# Phase 08 Plan 01: Owner Data Panel — Retroactive Summary

**One-liner:** Complete admin dashboard with user management (approve/revoke/delete/reset), feedback management, system stats, per-user data drill-down, and hybrid AI analysis.

## Objective

Build the admin panel where the app owner can access all collected user data in an organized format.

## Implementation Summary

### User Management
- List all users with status (approved/pending/revoked)
- Actions: approve, revoke, delete, reset password (generates temp password)
- View user profile + all onboarding data
- Expanded user card: recent energy logs, Sahha scores, biomarkers

### Statistics Panel
- Total users + approved count
- All-time sessions
- Active today count
- Unread feedback count
- User activity timeline

### Feedback Management
- List all feedback (categorized: bug, feature, improvement, support, other)
- View full chat history (user + AI assistant turns)
- Reply to feedback (persists in UserFeedback.adminReply)
- Mark read/unread
- Delete with attachment cleanup
- Italian time-ago labels (ora, N min fa, N h fa, N gg fa)

### Hybrid Analysis (AI-powered)
- Admin triggers analysis of all user data collectively
- Detects: usage patterns, churn risk, feature adoption
- Outputs: HybridAnalysis object with overall health score, patterns, predictions
- Session-cached to avoid repeated API calls

### User Approval Flow
1. New user registers → isApproved=false
2. Admin sees notification + pending user in list
3. Admin approves → Supabase sync
4. User can now use the app

### Data Access (per user)
- Full profiles (all onboarding fields)
- Energy logs (7-day recent or all with filter)
- Sahha scores + biomarkers
- Check-in history
- Goal progress
- Screen time logs
- Feedback & attachments

## Verification Against Success Criteria

- [x] Owner can see all user profiles and their data
- [x] Owner can see energy scores, daily logs, and behavior frequencies per user
- [x] Data is presented in structured tables and summaries

## Cross-Cutting Integration

- **Sahha data**: Per-user drill-down shows Sahha scores and biomarkers when available
- **Supabase**: Admin approval syncs via Supabase for cross-device consistency
- **Feedback system from Phase 7**: FeedbackChat data flows to admin panel for management
- **Hybrid AI**: Groq-powered cross-user analysis uses data from all phases
- **Auth from Phase 1**: Admin role checking via AuthContext, admin approval workflow

## Known Gaps

- No CSV/PDF export of data (deferred to v2, EXPORT-01..02)
- No user cohort segmentation UI
- No predictive churn alerts (only scoring)
- No data retention policy enforcement
- No usage analytics dashboard beyond basic stats

## Self-Check: PASSED
