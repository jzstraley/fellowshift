# Fellowship Scheduler - TODO List

## 🔴 Priority Fixes (Must Do)

### App Branding

- [X] Fix app name from "my-app" to "Fellowship Scheduler" in `package.json`
- [X] Update `<title>` in `index.html`
- [X] Add logo/icon to header
- [X] Add footer with copyright, disclaimer, "Created by Straley"

### Mobile Responsiveness

- [ ] Make all tables horizontally scrollable on mobile
- [ ] Touch-friendly buttons and controls
- [ ] Test on various screen sizes
- [ ] Replace drag-and-drop with tap-to-select or dropdowns on mobile

### UI Improvements

- [X] Add PGY dividers on Schedule page (between PGY-4/5/6)
- [X] Add PGY dividers on Stats page
- [X] Sticky headers on all table views
- [X] Highlight function - tap name or rotation to highlight across row/column
- [X] Vacation blocks - muted/gradient/different color styling

- [X] Move csv exporters to bottom.
- [X] Need to fix button bar
- [ ] Change IMport background dark
- [ ] Dark light icon not centered
- [ ] Background for tables not dark
- [ ] Remove inport/export/reset from vacations tab
- [ ] New color "Drag to swap rotations. Click a name, header, or cell to highlight. Toggle Vacation Mode to paint vacation blocks."

---

## 🟡 Logic Fixes

### Call/Float Generator

- [X] Constraint: Cannot do call weekend same weekend as night float
- [X] Prioritize even float distribution
- [X] PGY-4 targets prioritized over PGY-5 targets
- [ ] No night floats for PGy-6s last 3 months.

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
- [ ] Undo/redo for schedule changes
- [ ] Conflict detection warnings
- [ ] Fellow preferences input (vacation requests, rotation preferences)
- [ ] Analytics dashboard (workload metrics over time)
- [ ] Multi-year schedule planning
- [ ] Backup/restore functionality
- [ ] Share schedule via link

---

*Last updated: Feb 4, 2026*