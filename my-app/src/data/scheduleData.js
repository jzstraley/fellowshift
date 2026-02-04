// src/data/scheduleData.js

export const pgyLevels = {
  'Elkholy': 4, 'Naeem': 4, 'Nor': 4, 'Selvam': 4, 'Varga': 4,
  'Alkhawlani': 5, 'Ali': 5, 'Elsayed': 5, 'Ezaldin': 5, 'Sharma': 5,
  'Mahmoud': 6, 'Straley': 6, 'Yousafzai': 6
};

export const clinicDays = {
  // PGY-4
  'Elkholy': 1,    // Monday
  'Naeem': 3,      // Wednesday
  'Nor': 3,        // Wednesday
  'Selvam': 2,     // Tuesday
  'Varga': 4,      // Thursday
  // PGY-5
  'Alkhawlani': 3, // Wednesday 
  'Ali': 3,        // Wednesday 
  'Elsayed': 1,    // Monday 
  'Ezaldin': 2,    // Tuesday
  'Sharma': 4,     // Thursday 
  // PGY-6
  'Mahmoud': 3,    // Wednesday 
  'Straley': 2,    // Tuesday 
  'Yousafzai': 1,  // Monday 
};

export const initialSchedule = {
  'Elkholy': ['Cath', 'Cath', 'Echo', 'Echo', 'Floor A', 'Floor A', 'Nuclear', 'Nuclear', 'EP', 'EP', 'AI', 'AI', 'Floor B', 'Floor B', 'Echo', 'Echo', 'ICU', 'Nuclear', 'Nights', 'SPC', 'Floor A', 'Floor A', 'Nuclear', 'ICU', 'E', 'Nights'],
  'Naeem': ['Echo', 'Echo', 'Floor A', 'Floor A', 'Nuclear', 'Nuclear', 'EP', 'EP', 'Cath', 'Cath', 'Floor B', 'Floor B', 'Echo', 'Echo', 'ICU', 'Nuclear', 'Nights', 'SPC', 'Floor A', 'Floor A', 'Nuclear', 'ICU', 'E', 'Nights', 'AI', 'AI'],
  'Nor': ['EP', 'EP', 'Cath', 'Cath', 'Echo', 'Echo', 'Floor A', 'Floor A', 'Nuclear', 'Nuclear', 'Nights', 'E', 'AI', 'AI', 'Floor B', 'Floor B', 'Echo', 'Echo', 'ICU', 'Nuclear', 'Nights', 'SPC', 'Floor A', 'Floor A', 'Nuclear', 'ICU'],
  'Selvam': ['Floor A', 'Floor A', 'Nuclear', 'Nuclear', 'EP', 'EP', 'Cath', 'Cath', 'Floor B', 'Floor B', 'Echo', 'Echo', 'ICU', 'Nuclear', 'Nights', 'SPC', 'Floor A', 'Floor A', 'Nuclear', 'ICU', 'Research', 'Nights', 'AI', 'AI', 'Echo', 'Echo'],
  'Varga': ['Nuclear', 'Nuclear', 'EP', 'EP', 'Cath', 'Cath', 'Echo', 'Echo', 'Floor A', 'Floor A', 'Nuclear', 'ICU', 'Nuclear', 'Nights', 'AI', 'AI', 'Floor B', 'Floor B', 'Echo', 'Echo', 'ICU', 'AI', 'Nights', 'SPC', 'Floor A', 'Floor A'],
  'Alkhawlani': ['Nights', 'Floor B', 'Nuclear 2', 'Nuclear 2', 'ICU', 'Cath 2', 'Floor B', 'Cath 2', 'ICU', 'AI', 'Nuclear 2', 'Nuclear 2', 'Floor A', 'Cath 2', 'EP', 'EP', 'Echo 2', 'Echo 2', 'AI', 'Floor B', 'Echo 2', 'Echo 2', 'ICU', 'Cath 2', 'Nights', 'AI 2'],
  'Ali': ['Floor B', 'Nights', 'Cath 2', 'ICU', 'Nuclear 2', 'Floor B', 'Cath 2', 'Floor B', 'AI', 'ICU', 'AI 2', 'AI 2', 'Nuclear 2', 'Nuclear 2', 'Floor A', 'Cath 2', 'Nuclear 2', 'Nights', 'Echo 2', 'Echo 2', 'EP', 'EP', 'Echo 2', 'Echo 2', 'ICU', 'Cath 2'],
  'Elsayed': ['AI', 'ICU', 'AI', 'Nights', 'Floor B', 'Echo 2', 'Nuclear 2', 'Nuclear 2', 'Cath 2', 'Cath 2', 'Floor A', 'Echo 2', 'Cath 2', 'ICU', 'Echo 2', 'Echo 2', 'Cath 2', 'ICU', 'AI 2', 'Nights', 'Nuclear 2', 'Floor B', 'EP', 'EP', 'Nuclear 2', 'Floor B'],
  'Ezaldin': ['Cath 2', 'Cath 2', 'ICU', 'AI', 'Nights', 'AI 2', 'ICU', 'Echo 2', 'Nights', 'Echo 2', 'ICU', 'Floor A', 'Echo 2', 'Echo 2', 'Nuclear 2', 'Nuclear 2', 'EP', 'EP', 'Floor B', 'AI', 'Cath 2', 'Cath 2', 'Floor B', 'Nuclear 2', 'Floor B', 'Nuclear 2'],
  'Sharma': ['ICU', 'Echo 2', 'Echo 2', 'Floor B', 'Cath 2', 'ICU', 'AI', 'Nights', 'Nuclear 2', 'Nuclear 2', 'EP', 'Nights', 'EP', 'Floor A', 'Cath 2', 'ICU', 'AI', 'AI', 'Cath 2', 'Cath 2', 'Floor B', 'Nuclear 2', 'Nuclear 2', 'Floor B', 'Echo 2', 'Echo 2'],
  'Mahmoud': ['Nuclear 2', 'Nuclear 2', 'AI 2', 'AI 2', '', '', 'Echo 2', 'ICU', 'Echo 2', 'Nights', 'Research', 'Structural', 'Nights', 'Vascular', 'Cath', 'Cath', 'AI 2', 'AI 2', 'CTS', '', '', '', 'AI 2', 'AI 2', 'Research', 'Research'],
  'Straley': ['Echo 2', 'Vascular', 'Nights', 'Cath 2', 'Cath 3', 'Cath 3', 'Nights', 'Structural', 'AI 2', 'AI 2', 'Echo 2', '', 'AI 2', 'AI 2', 'AI 2', 'Floor A', '', 'CTS', 'Nuclear 2', 'Nuclear 2', '', '', '', 'Admin', 'Admin', 'AI 2'],
  'Yousafzai': ['AI 2', 'AI 2', 'Floor B', 'Echo 2', 'Echo 2', 'Nights', 'AI 2', 'AI 2', '', '', 'Cath 2', 'Cath 2', 'Vascular', '', 'CTS', 'Nights', '', 'Admin', 'Structural', '', 'AI 2', 'AI 2', 'SPC', '', 'Research 2', 'Research 2']
};

export const blockDates = [
  { block: 1, start: '2026-07-01', end: '2026-07-12', rotation: 1 },
  { block: 2, start: '2026-07-13', end: '2026-07-26', rotation: 1 },
  { block: 3, start: '2026-07-27', end: '2026-08-09', rotation: 2 },
  { block: 4, start: '2026-08-10', end: '2026-08-23', rotation: 2 },
  { block: 5, start: '2026-08-24', end: '2026-09-06', rotation: 3 },
  { block: 6, start: '2026-09-07', end: '2026-09-20', rotation: 3 },
  { block: 7, start: '2026-09-21', end: '2026-10-04', rotation: 4 },
  { block: 8, start: '2026-10-05', end: '2026-10-18', rotation: 4 },
  { block: 9, start: '2026-10-19', end: '2026-11-01', rotation: 5 },
  { block: 10, start: '2026-11-02', end: '2026-11-15', rotation: 5 },
  { block: 11, start: '2026-11-16', end: '2026-11-29', rotation: 6 },
  { block: 12, start: '2026-11-30', end: '2026-12-13', rotation: 6 },
  { block: 13, start: '2026-12-14', end: '2026-12-27', rotation: 7 },
  { block: 14, start: '2026-12-28', end: '2027-01-10', rotation: 7 },
  { block: 15, start: '2027-01-11', end: '2027-01-24', rotation: 8 },
  { block: 16, start: '2027-01-25', end: '2027-02-07', rotation: 8 },
  { block: 17, start: '2027-02-08', end: '2027-02-21', rotation: 9 },
  { block: 18, start: '2027-02-22', end: '2027-03-07', rotation: 9 },
  { block: 19, start: '2027-03-08', end: '2027-03-21', rotation: 10 },
  { block: 20, start: '2027-03-22', end: '2027-04-04', rotation: 10 },
  { block: 21, start: '2027-04-05', end: '2027-04-18', rotation: 11 },
  { block: 22, start: '2027-04-19', end: '2027-05-02', rotation: 11 },
  { block: 23, start: '2027-05-03', end: '2027-05-16', rotation: 12 },
  { block: 24, start: '2027-05-17', end: '2027-05-30', rotation: 12 },
  { block: 25, start: '2027-05-31', end: '2027-06-13', rotation: 13 },
  { block: 26, start: '2027-06-14', end: '2027-06-27', rotation: 13 }
];

export const initialVacations = [
  { fellow: 'Alkhawlani', startBlock: 3, endBlock: 4, reason: 'Vacation' }
];
