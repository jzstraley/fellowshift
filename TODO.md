# FellowShift — TODO

---

## 🔴 High Priority

### Mobile & UI Fixes

- [X] Touch-friendly tap targets on all interactive elements (min 44×44px)
- [ ] Test on iOS Safari and Android Chrome (safe-area insets, font scaling)
- [ ] Horizontal-scroll tables on mobile (Schedule view still overflows on small screens)

### Swap Request Approval Flow

- [X] Create `swap_requests` table in Supabase (migration 010, fields: id, requester_fellow_id, target_fellow_id, block_number, status, from/to_week_part)
- [X] Build 'Request Swap' UI on schedule — Fellow 1 selects a shift and a target fellow, submits request
- [X] Trigger in-app notification to Fellow 2 on new `pending_peer` request (Phase 3 — migration 019 + bell icon)
- [X] Fellow 2 sees swap inbox: Accept / Decline — Accept moves status → `pending` (two-tier peer approval, migration 018)
- [X] Notify admin/PD pool on peer approval — any one of them can approve or reject (Phase 3 — DB trigger fan-out)
- [X] Only on `approved` status: write the actual `call_float_assignments` swap to DB, preserve relaxed flag (migration 018 + approveDbSwap)
- [X] Notify both fellows of final outcome (Phase 3 — DB trigger on approved/denied status)
- [ ] Swap request history log per fellow in their profile view (Future)

### Swap Engine (Rule-Aware)

- [ ] Define eligibility rule schema: PGY match, duty hour ceiling, vacation overlap check, rotation restriction flags
- [ ] Build Supabase function: `get_eligible_swap_candidates(shift_id, requester_id)` — reads `fellows`, `block_assignments`, `vacation_requests`, `duty_hour_rules`
- [ ] On 'Request Swap' open: call function and return ranked eligible fellows only — ineligible grayed out with reason tooltip
- [ ] Build fairness score per fellow: composite of recent call burden, swap history, total off days
- [ ] Surface fairness score in swap candidate list — sort by most fair by default, allow manual override
- [ ] After admin approval: auto-write `schedule_assignments` swap atomically (transaction — both sides update or neither does)
- [ ] Log swap in `swap_history` with pre/post state snapshot for audit trail
- [ ] Expose swap stats in admin dashboard: most swapped fellows, most requested shifts, fairness distribution

### Duty Hour Risk Monitor

- [ ] Define `duty_hour_rules` table: max hours/week (80), max shift length, min time off between shifts, max consecutive days — configurable per program
- [ ] Build Supabase scheduled function (pg_cron or Edge Function cron): runs nightly, reads call + float + service + clinic assignments per fellow
- [ ] Calculate rolling 7-day hour totals per fellow — flag at >70hrs (warning) or >80hrs (violation)
- [ ] Output `risk_score` per fellow: Green / Yellow / Red with specific violation type
- [ ] Admin dashboard widget: Duty Hour Status — sortable by risk score, expandable per fellow
- [ ] Proactive alert: block save if new assignment would push fellow into violation — show specific rule being violated
- [ ] Monthly export: ACGME-formatted duty hour summary per fellow — PDF or CSV
- [ ] Fellow view: personal duty hour tracker showing current week hours, remaining hours, rest period status

---

## 🟡 Medium Priority

### Requests & Vacations

- [ ] Email notifications on request approval/denial (Supabase Edge Function → send email)
- [ ] Push notification support (PWA service worker + Web Push API)
- [ ] Request history: allow fellows to see all past (approved/denied/cancelled) requests in one list
- [ ] Bulk approve: allow approvers to approve multiple pending requests at once
- [ ] CME day tracking: link day-off requests to a CME budget per fellow per year

### Schedule

- [ ] Export schedule to Google Calendar / iCal format (ICS file download)
- [ ] Multi-year schedule planning / carry-forward from previous year
- [ ] Schedule diff view: show what changed between two versions

### Admin: Edit Fellow Emails

- [ ] Add inline edit (pencil icon) next to each fellow's email on Admin > Fellows list
- [ ] On save, update `profiles` table email field AND Supabase Auth email if applicable
- [ ] Confirm whether email updates cascade to auth login or just contact/notification email
- [ ] RLS: restrict mutation to admin/PD role only

### Lecture File Storage

- [ ] Create `lecture-slides` storage bucket in Supabase (public read, authenticated upload)
- [ ] Add `file_url` and `file_name` columns to `lectures` table
- [ ] Upload button on lecture edit page — accept PDF and PPTX, enforce 50MB max
- [ ] Store Supabase Storage public URL in `lectures.file_url`
- [ ] Paperclip icon on lecture list if file exists — opens PDF in new tab or downloads PPTX
- [ ] Consider Supabase Pro upgrade ($25/mo) if storage exceeds 1GB
- [ ] Archive old cohort lectures by academic year folder prefix in the bucket
- [ ] Recurring lecture series support (weekly grand rounds, monthly M&M)
- [ ] Gmail / calendar integration for automated lecture reminders
- [ ] Speaker bio and contact info in lecture detail modal
- [ ] Lecture topic archive / search across past lectures

### Stats & Reporting

- [ ] Analytics dashboard: workload metrics over time (call burden, night float frequency)
- [ ] Exportable PDF/CSV report of time-off summary per fellow
- [ ] Rotation equity metrics (who has gotten which rotations, year-over-year)

### Native Mobile App (Capacitor)

- [ ] Audit app for `localStorage` usage — migrate to Capacitor Preferences plugin
- [ ] Install Capacitor: `npm install @capacitor/core @capacitor/cli`
- [ ] Add platforms: `npx cap add ios && npx cap add android`
- [ ] Configure splash screen, app icon, bundle ID in `capacitor.config.ts`
- [ ] Implement push notifications plugin — wire to swap approvals and duty hour alerts
- [ ] Test on real devices (not just emulators)
- [ ] Apple Developer account ($99/yr) + Google Play Console ($25 one-time)
- [ ] Submit to App Store + Play Store

---

## 🟢 Lower Priority

### Infrastructure

- [ ] PWA manifest + service worker for offline support and home screen install
- [ ] Backup/restore: export full program state (schedule + requests + fellows) as JSON
- [ ] Share schedule via read-only link (public token-scoped view)
- [ ] Multi-program admin view (institution-level super-admin sees all programs)
- [ ] Architect DB schema with `program_id` scoping now — enables multi-program support later

### UX Polish

- [X] CalendarView max-width bounds per breakpoint — prevents over-expansion on fullscreen/wide displays (lg→3xl, xl→4xl, 2xl→5xl)
- [X] ScheduleView color key — compact rotation legend at the bottom of the schedule tab
- [ ] Keyboard shortcut reference modal (Ctrl+/ or ? key)
- [ ] Onboarding flow for new programs: step-by-step setup wizard (fellows → blocks → schedule)
- [ ] Print-friendly schedule view (full print CSS pass)
- [ ] Drag-and-drop schedule editing (re-assign rotations visually)

---

## 💡 Ideas & Future Features

### Platform Module Structure

- [ ] Restructure nav around 4 modules: Scheduling / Operations / Education / Analytics
- [ ] **Scheduling:** schedule editor, swap engine, vacation planner
- [ ] **Operations:** coverage radar, sick call coverage, duty hour monitor
- [ ] **Education:** case library, procedure tracker, board prep
- [ ] **Analytics:** call equity, workload metrics, program dashboards
- [ ] Mobile nav: modules as top-level destinations, sub-features inside each
- [ ] Admin sees all modules; fellows see role-appropriate subset

### Procedure Logger (QR + New Innovations)

- [ ] QR code on attending badge/door → opens procedure log form on fellow's phone
- [ ] Log fields: procedure type, date, attending, complexity, rotation — no FIN, no PHI
- [ ] Auto-export to New Innovations CSV format (map fields to NI import schema)
- [ ] Procedural competency tracker: tally per ACGME category, show % toward minimum
- [ ] "Cases needed" dashboard — how many more caths/echos/CICU procedures to graduation
- [ ] Research NI API or SSO: check if pre-populating fields is possible without storing patient data

### Personal Dashboard — Today

- [ ] Service card: current rotation, reading attending for today
- [ ] Task list: daily checklist, fellow-editable, resets or carries over at midnight
- [ ] Widgets: next shift countdown, next lecture, pending swap requests — one glance
- [ ] Configurable: fellows choose which cards appear on their dashboard

### "Am I Free?" Button

- [ ] Single tap: queries schedule for tonight / this weekend / next 14 days
- [ ] Returns plain language answer: "Free tonight" / "On call Saturday" / "Next free window: Wed–Thu"
- [ ] Lives on home screen dashboard as a prominent card — not buried in nav
- [ ] Optional: shareable link for co-fellows coordinating coverage

### Rotation Intelligence

- [ ] Per-rotation stats card: studies read, didactics attended, board Qs correct, procedures logged
- [ ] Learning yield score: composite metric → HIGH / MEDIUM / LOW per rotation
- [ ] Fellow view: historical yield scores across all completed blocks
- [ ] Admin/PD view: aggregate yield across all fellows — identify underdelivering rotations
- [ ] Flag low-yield rotations to PD with supporting data
- [ ] Rotation comparison chart: side-by-side yield across rotation types for a cohort year
- [ ] Year-over-year tracking: does yield improve after curriculum changes?
- [ ] Export: rotation intelligence summary per fellow for end-of-year review

### Micro-Learning Feed

- [ ] Daily feed card: 2-3 minute learning bite tied to rotation/clinical context
- [ ] Manual trigger: fellow tags a diagnosis → generates focused micro-lesson on the spot
- [ ] Lesson structure: 3-5 bullets, guideline-grounded, board-relevant
- [ ] Claude API for on-demand lesson generation
- [ ] Rotation-aware suggestions: Echo rotation → echo topics, CICU → shock/hemodynamics
- [ ] Lesson completion feeds into Rotation Intelligence yield score
- [ ] Spaced repetition: topics resurface at 3-day / 7-day / 30-day intervals
- [ ] Bookmark lessons for later review
- [ ] Weekly digest: "5 things from your rotation this week" — auto-generated
- [ ] Board tagging: each lesson tagged to ACC/AHA guideline section + ABIM blueprint topic
- [ ] HIPAA: no patient identifiers — diagnosis tags only, entered manually by fellow

### "Ask The Program" AI

- [ ] Chat interface: fellows ask plain language questions answered from program documents
- [ ] Admin uploads source docs: handbook, rotation guides, institutional policies, call guides
- [ ] RAG architecture: pgvector embeddings → similarity search → Claude API answer with citations
- [ ] Every answer cites source document and section — no hallucinated policy
- [ ] Admin marks documents active/inactive — old versions don't pollute answers
- [ ] Confidence indicator: high / uncertain — if no relevant chunk, says "ask your chief"
- [ ] Audit log: admins see what fellows are asking — surfaces policy gaps
- [ ] PD pinned answers override AI for sensitive or frequently misunderstood rules
- [ ] Phase 2: ingest ACGME program requirements documents

### The Vision: Residency OS

- [ ] Define FellowShift positioning: "Residency Operations Software" — not just a scheduler
- [ ] Procedure log toward ACGME case minimums
- [ ] Rotation dashboard per fellow: upcoming rotations, call, vacation, case completion %
- [ ] Evaluation nudges: auto-remind attendings post-rotation block
- [ ] Attendance analytics for PD review cycles
- [ ] Anonymous peer feedback: 360-style, aggregated not attributed
- [ ] Conference / sim lab booking calendar
- [ ] Landmark trials quiz engine
- [ ] On-call handbook wiki: versioned markdown, attending-editable, fellow-readable

---

## ✅ Recently Completed

- [X] Vacation display & calculation consistency fixes (2026-03-14)
    - [X] Fixed StatsView day calculation to use actual calendar dates instead of block-count estimate
    - [X] Added deduplication logic to prevent double-counting vacation requests
    - [X] Fixed case-sensitive status checks across ScheduleView, CalendarView, MobileScheduleView, scheduleUtils — vacations now display correctly as "VAC" blocks
    - [X] Fixed FeedbackModal prop passing — "Send Feedback" link now works
    - [X] Calendar month header now uses teal color to match list headers
- [X] Schedule Edit Conflict — Rethink
    - [X] Enable Supabase Realtime presence channel on schedule page (`channel: 'schedule-presence'`)
    - [X] On entering edit mode, broadcast presence event: `{ user: name, editing: true }`
    - [X] All viewers see yellow banner: '⚠ [Name] is currently editing the schedule' — no error, no block
    - [X] Second editor gets soft modal warning — not a hard error
    - [X] On exit from edit mode, clear presence broadcast so banner auto-dismisses
    - [X] Add optimistic last-write-wins with 'schedule updated since you started editing — reload?' prompt on save conflict
    - [X] Remove existing error-throwing lock mechanism entirely (N/A — no lock existed)
    - [X] Conflict detection warnings in Schedule Editor before save (double-booked, coverage gaps)
- [X] Auth & Session Stability
    - [X] Harden session persistence across tabs (broadcast channel or storage event sync)
    - [X] Silent retry for profile loads on RLS/network hiccup (avoid auth appearing broken on transient errors)
    - [X] Unify role/permission gating so admin UX is consistent everywhere (dashboard, approvals, stats, schedule edit)
- [X] Feedback Section: user menu "Send Feedback" link, modal form (category/message/anonymous toggle), admin feedback log tab with open/resolved status (migration 017)
    - [X] Add 'Send Feedback' link in user menu dropdown
    - [X] Modal form: Type (Bug / Feature Request / Other), Message textarea, anonymous toggle
    - [X] Store feedback in `feedback` table for log (migration 017)
    - [X] Surface feedback log in admin panel with open/resolved status toggle
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
- [X] Lecture Calendar: Apple Calendar-style redesign
    - [X] Pill-shaped month/year header with ChevronLeft/ChevronRight navigation arrows
    - [X] iOS-style segmented control for view modes (Calendar, Agenda, List, Presenters, Manage)
    - [X] Apple-style calendar grid with centered dates (horizontal + vertical), square aspect-ratio cells, blue highlight for today
    - [X] Mobile tab reorganization: vertical stack on mobile (flex-col), horizontal on desktop (flex-row) with reduced gaps
    - [X] Compact form modal: reduced padding (p-3), spacing (space-y-2), label margins (mb-0.5), grid gaps (gap-2), max-h-[70vh] scrollable
- [X] Lecture series: Added "Multi-Modality Lecture" and "Grand Rounds" to LECTURE_SERIES in lectureData.js
- [X] Modal close buttons (X): centered within flex container (flex items-center justify-center w-6 h-6 rounded) across FeedbackModal, PoliciesView, HeaderBar
- [X]Mobile and UI
    - [X] Remove Stats section from fellow bottom nav
    - [X] Remove Requests from hamburger top-right menu (redundant with bottom tab)
    - [X] Requests page layout: Pending at top → New Request button below it → Approved/Denied at bottom
    - [X] Approved/Denied as tabbed pair filtering one historical list, not two separate stacked boxes
    - [X] Scroll-to-top on route change: `useEffect(() => window.scrollTo({ top: 0, behavior: 'smooth' }), [activeView])` — apply globally
    - [X] Active state: weight change + underline dot in brand color only — no colorizing tabs

---

## 🗑️ Removed / Won't Do

- Toggle Vacation Mode paint (replaced by dedicated swap/request workflow)
- GmailIntegration component (removed; may revisit as Edge Function)
