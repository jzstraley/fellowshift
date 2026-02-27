# Fellowship Scheduler - TODO List

## 🔴 Priority Fixes (Must Do)

### Mobile Responsiveness

- [ ] Make all tables horizontally scrollable on mobile
- [ ] Touch-friendly buttons and controls
- [ ] Test on various screen sizes

### UI Improvements

- [X] Move csv exporters to bottom.
- [X] Need to fix button bar
- [ ] Change IMport background dark
- [ ] Dark light icon not centered
- [X] Background for tables not dark
- [X] Remove inport/export/reset from vacations tab
- [X] Click a name, header, or cell to highlight.
- [ ] Toggle Vacation Mode to paint vacation blocks.
- [X] Remove PGY year on Clinic schedule
    - [X] Fix UI for Clinic on mobile, just equal space
- [X] Could not find the table public.lecture_speaker when submitting a change request
- [ ] Fellow View TODO
    - [ ] when logging back in, login should end up on home page
    - [ ] Unable to request time off/page not available for fellows
- [ ] Currently there is a vacation request for fellow Ali, for some reason it appears he is on vacation already on the schedule view. Maybe Ali and Alkhawlani got switched around because Alkhawlani already has two weeks of vacation approved. Also on the schedule view, Alkhawlani is not on vacation. Also if vacation is only one week of a 2 week block, the schedule view should show like "AI/VAC" or "VAC/AI" depending on which week was chosen. The schedule view should not update with vacations until they are approved.
- [ ] admins should be able to create requests for anyone. users should be able to only create time off requests for themselves. I also want the specific username "fellow" to be able to create requests for anyone. that is my tester person and has fellow-like priveldges.
- [ ] Local mode?
- [ ] Also should have an option for an individual day off like a sick day on the requests tab Can be a different tab in the requests page
- [ ] on the requests tab, request list is now scoped to the fellow's own requests; approve/deny buttons only shown to approvers. Remaining: display format still shows "Blocks 2-1–2-1 — Vacation" — needs to show dates with timestamp instead
- [ ] Fix profile not loading (RLS or join issue causing profile = null)
    - [ ] index-CMUShsm2.js:53 Auth check timed out - continuing without auth
(anonymous) @ index-CMUShsm2.js:53Understand this warning;;        const J = setTimeout( () => {console.warn("Auth check timed out - continuing without auth"), h(!1)}, 1e4);

---

## 🟡 Logic Fixes

### Access control

- [X] Fellows see their own program's schedule
- [X] Chiefs can edit their program
- [X] Program directors see all

### Call/Float Generator

- [X] Constraint: Cannot do call weekend same weekend as night float
- [X] Prioritize even float distribution
- [X] PGY-4 targets prioritized over PGY-5 targets
- [X] No night floats for PGy-6s last 3 months.

### Clinic Coverage

- [X] Change from bi-weekly to weekly coverage assignments
- [X] Skip June 2026 for clinic coverage (blocks 25-26)
- [X] Balance to ~2 coverage assignments per fellow
- [X] Different person each week (no back-to-back same coverer)

---

## 🟢 Restore Missing Features

- [X] Restore Vacation/Request page
- [ ] Vacation input and display functionality

---

## ✅ Recently Completed

- [X] Smart schedule-swap picker: select your own assigned shift → app shows only valid partners (filtered by vacation/away, grouped by fellow), bilateral swap encoded in reason string, bilateral approval updates both slots. Auth schema aligned (booleans, not function calls). All stub UI sections (timeoff, dayoff, swaps) fully implemented.

## 🔵 Future Features

### Lecture Scheduler (New Module)

- [ ] Lecture calendar with date/time/topic
- [ ] Speaker/presenter assignments
- [ ] Gmail integration for automated reminders
- [ ] RSVP tracking
- [ ] Topic/speaker management database
- [ ] Recurring lecture series support

### Other Ideas

- [ ] Export to Google Calendar / iCal
- [X] Print-friendly views
- [X] Dark mode
- [X] Undo/redo for schedule changes
- [ ] Conflict detection warnings
- [ ] Fellow preferences input (vacation requests, rotation preferences)
- [ ] Analytics dashboard (workload metrics over time)
- [ ] Multi-year schedule planning
- [ ] Backup/restore functionality
- [ ] Share schedule via link

---

Data structure:
Users table: user_id, name, fellowship_program, role
Schedules table: schedule_id, program_id, date, user_id, shift_type, location
Programs table: program_id, program_name (cardiology, etc.)
Key features for medical scheduling:

Calendar view (monthly/weekly)
Export to personal calendar (iCal)
Duty hour tracking (ACGME compliance)

React scheduler libraries:

FullCalendar - most feature-rich
React Big Calendar - simpler, good for basic needs
DayPilot - medical-specific features
