# FellowShift — TODO

---

## ✅ Recently Completed

- [X] Supabase Realtime subscription: live toasts for request approvals/denials and schedule updates (App.jsx)
- [X] Pending request badge on Requests nav tab (desktop, mobile bottom nav, More sheet)
- [X] Request filter bar (search by fellow name) + newest/oldest sort in VacationsView
- [X] Mobile responsiveness: request cards in TimeOffView, DayOffView, SwapsView now stack on narrow screens
- [X] Board Exam and FLEX Day added as day-off reason types (form + DAY_OFF_SET classification)
- [X] Deleted dead `src/services/requestService.js`
- [X] PoliciesView rewritten: DB-backed CRUD (add/edit/delete) for admins/PDs/chiefs, categorized with icons, falls back to static list (migration 016)
- [X] StatsView: "Time Off Summary" table showing approved vacation blocks and day-off counts per fellow, grouped by PGY
- [X] TimeOffView: vacation date ranges display as human-readable dates ("Jan 15 – Jan 28"); request cards show approver name
- [X] Fixed `ensureBlockDateIdForUiWeek` block number lookup; `week_part` stored on vacation_requests
- [X] Import/Export bar scoped to call/clinic views and admin/PD/chief roles only
- [X] Migration 015: fixed vacation_requests UPDATE RLS for users missing program_memberships rows
- [X] Dashboard "Pending Approvals" card lists vacation, day off, and swap requests as separate line items
- [X] Smart swap picker: valid partners filtered by vacation/away; bilateral swap approval updates both slots
- [X] Lecture attendance tracking (check-in window, attendance roster, admin controls, fellow self-check-in)
- [X] Fellows can cancel their own pending requests (status → cancelled)
- [X] Request lists scoped: non-approvers see only their own requests
- [X] Dashboard redesign with greeting, current block hero banner, quick links for fellows
- [X] ACGME work-hour violation checker + Violations view with fix suggester
- [X] Session idle timeout (15 min) with warning modal at 13 min
- [X] AES-GCM encrypted localStorage for sensitive cached data
- [X] Undo/redo for schedule changes (dual stack, Ctrl+Z / Ctrl+Shift+Z)
- [X] Dark mode (full Tailwind dark: variants across all components)

---

## 🔴 High Priority

### Auth & Session Stability

- [ ] Harden session persistence across tabs (broadcast channel or storage event sync)
- [ ] Silent retry for profile loads on RLS/network hiccup (avoid auth appearing broken on transient errors)
- [ ] Unify role/permission gating so admin UX is consistent everywhere (dashboard, approvals, stats, schedule edit)

### Mobile

- [ ] Touch-friendly tap targets on all interactive elements (min 44×44px)
- [ ] Test on iOS Safari and Android Chrome (safe-area insets, font scaling)
- [ ] Horizontal-scroll tables on mobile (Schedule view still overflows on small screens)

---

## 🟡 Medium Priority

### Requests / Vacations

- [ ] Email notifications on request approval/denial (Supabase Edge Function → send email)
- [ ] Push notification support (PWA service worker + Web Push API)
- [ ] Request history: allow fellows to see all past (approved/denied/cancelled) requests in one list
- [ ] Bulk approve: allow approvers to approve multiple pending requests at once
- [ ] CME day tracking: link day-off requests to a CME budget per fellow per year

### Schedule

- [ ] Export schedule to Google Calendar / iCal format (ICS file download)
- [ ] Conflict detection warnings in Schedule Editor before save (double-booked, coverage gaps)
- [ ] Multi-year schedule planning / carry-forward from previous year
- [ ] Schedule diff view: show what changed between two versions

### Stats & Reporting

- [ ] Analytics dashboard: workload metrics over time (call burden, night float frequency)
- [ ] Exportable PDF/CSV report of time-off summary per fellow
- [ ] Rotation equity metrics (who has gotten which rotations, year-over-year)

---

## 🟢 Lower Priority / Future

### Lectures

- [ ] Recurring lecture series support (weekly grand rounds, monthly M&M)
- [ ] Gmail / calendar integration for automated lecture reminders
- [ ] Speaker bio and contact info in lecture detail modal
- [ ] Lecture topic archive / search across past lectures

### Infrastructure

- [ ] PWA manifest + service worker for offline support and home screen install
- [ ] Backup/restore: export full program state (schedule + requests + fellows) as JSON
- [ ] Share schedule via read-only link (public token-scoped view)
- [ ] Multi-program admin view (institution-level super-admin sees all programs)

### UX Polish

- [ ] Keyboard shortcut reference modal (Ctrl+/ or ? key)
- [ ] Onboarding flow for new programs: step-by-step setup wizard (fellows → blocks → schedule)
- [ ] Print-friendly schedule view (full print CSS pass)
- [ ] Drag-and-drop schedule editing (re-assign rotations visually)

---

## 🗑️ Removed / Won't Do

- Toggle Vacation Mode paint (replaced by dedicated swap/request workflow)
- GmailIntegration component (removed; may revisit as Edge Function)
