# FellowShift

A scheduling and management web app for medical programs. Built with React, Tailwind CSS, and Supabase.

---

## Features

### Dashboard

- Time-of-day greeting with current block, days remaining, and year progress
- Admins see pending approvals and ACGME violations; fellows see their own requests and quick links
- Call/Night Float duties shown with colored pill badges

### Schedule View

- Full 26-block academic year schedule per fellow
- Block selector dropdown with auto-detection of current block
- Click fellow names, block headers, or cells to highlight; rotation filter to highlight all instances of a rotation
- PGY divider rows; consecutive blocks grouped with spanning headers

### Schedule Editor

- Drag-and-assign rotation editing with full undo/redo (Ctrl+Z / Ctrl+Shift+Z, up to 30 snapshots)
- Validate before saving: checks for double-booking, coverage gaps, and ACGME violations
- Change log panel showing recent edits with jump-to-state support
- Validate & Save pushes full schedule to Supabase; Sync pulls on demand

### Call / Float Generator

- Auto-generates call weekend and night float assignments
- Constraints: no call same weekend as night float, even float distribution, PGY-4 targets before PGY-5, no night float for PGY-6s in final 3 months
- Balance check table (program directors only)

### Clinic Coverage

- Weekly clinic coverage assignments with monthly calendar view
- PGY-colored badges for regular clinic; amber for covering a nights slot; red for uncovered
- Balanced at ~2 assignments per fellow; no back-to-back same coverer

### Vacations & Requests

- Time off requests, individual day-off requests, and rotation swap requests
- Fellows can submit and cancel their own requests; admins/directors can submit for any fellow
- Approvers can approve or deny; fellows only see their own requests
- All requests backed by Supabase with audit tracking

### ACGME Violations

- Day-by-day shift timeline per fellow flags 80h weekly average, 24+4h max shift, 1-in-7 day off, and other ACGME rules
- Filter by fellow, rule, and severity; suggested fixes with swap/reassignment options

### Lecture Calendar

- Monthly calendar with lecture management (title, speaker, topic, date, time, location, series)
- Speaker and topic database with categorization by series
- Recurring lecture support (one-time, weekly, bi-weekly, monthly)

### Stats View

- Rotation distribution and workload metrics (admin/program director only)

### Admin View

- Manage institution users: list all profiles, change roles, invite new users by email (admin only)

---

## Tech Stack

- **Frontend:** React, Tailwind CSS, Lucide icons
- **Backend:** Supabase (Postgres, Auth, RLS)
- **Storage:** AES-GCM encrypted localStorage for local state; Supabase for all persistent data

## Navigation

`Home` | `Schedule` | `Editor` | `Stats` | `Call/Float` | `Calendar` | `Clinic` | `Vacations` | `Lectures` | `Admin`

---

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `1`–`9` | Switch views |
| `←` / `→` | Month navigation in Lecture Calendar |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / Redo in Schedule Editor |
| `Escape` | Close modals |

Session auto-signs out after 15 minutes of inactivity (warning at 13 minutes).

---

© 2026 IMTechEd by Austin Straley, DO
