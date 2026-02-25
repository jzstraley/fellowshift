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
  { fellow: 'Alkhawlani', startBlock: 3, endBlock: 3, reason: 'Vacation', status: 'approved' }
];

// Initial call and night-float base provided by user
export const initialCallSchedule = {
  'B1-W1': 'Elsayed', 'B1-W2': 'Sharma',
  'B2-W1': 'Yousafzai', 'B2-W2': 'Elsayed',
  'B3-W1': 'Sharma', 'B3-W2': 'Ezaldin',
  'B4-W1': 'Straley', 'B4-W2': 'Sharma',
  'B5-W1': 'Ali', 'B5-W2': 'Straley',
  'B6-W1': 'Alkhawlani', 'B6-W2': 'Ali',
  'B7-W1': 'Mahmoud', 'B7-W2': 'Ezaldin',
  'B8-W1': 'Alkhawlani', 'B8-W2': 'Yousafzai',
  'B9-W1': 'Nor', 'B9-W2': 'Naeem',
  'B10-W1': 'Elkholy', 'B10-W2': 'Ezaldin',
  'B11-W1': 'Elkholy', 'B11-W2': 'Ali',
  'B12-W1': 'Elsayed', 'B12-W2': 'Varga',
  'B13-W1': 'Selvam', 'B13-W2': 'Naeem',
  'B14-W1': 'Ezaldin', 'B14-W2': 'Naeem',
  'B15-W1': 'Ezaldin', 'B15-W2': 'Mahmoud',
  'B16-W1': 'Varga', 'B16-W2': 'Selvam',
  'B17-W1': 'Elkholy', 'B17-W2': 'Varga',
  'B18-W1': 'Elsayed', 'B18-W2': 'Nor',
  'B19-W1': 'Varga', 'B19-W2': 'Nor',
  'B20-W1': 'Selvam', 'B20-W2': 'Naeem',
  'B21-W1': 'Ali', 'B21-W2': 'Varga',
  'B22-W1': 'Alkhawlani', 'B22-W2': 'Naeem',
  'B23-W1': 'Elkholy', 'B23-W2': 'Alkhawlani',
  'B24-W1': 'Elkholy', 'B24-W2': 'Selvam',
  'B25-W1': 'Nor', 'B25-W2': 'Sharma',
  'B26-W1': 'Nor', 'B26-W2': 'Selvam'
};

export const initialNightFloatSchedule = {
  'B1-W1': 'Ezaldin', 'B1-W2': 'Alkhawlani',
  'B2-W1': 'Mahmoud', 'B2-W2': 'Ali',
  'B3-W1': 'Mahmoud', 'B3-W2': 'Straley',
  'B4-W1': 'Yousafzai', 'B4-W2': 'Elsayed',
  'B5-W1': 'Naeem', 'B5-W2': 'Ezaldin',
  'B6-W1': 'Selvam', 'B6-W2': 'Yousafzai',
  'B7-W1': 'Naeem', 'B7-W2': 'Straley',
  'B8-W1': 'Naeem', 'B8-W2': 'Elkholy',
  'B9-W1': 'Ali', 'B9-W2': 'Ezaldin',
  'B10-W1': 'Straley', 'B10-W2': 'Sharma',
  'B11-W1': 'Varga', 'B11-W2': 'Nor',
  'B12-W1': 'Selvam', 'B12-W2': 'Sharma',
  'B13-W1': 'Nor', 'B13-W2': 'Mahmoud',
  'B14-W1': 'Nor', 'B14-W2': 'Varga',
  'B15-W1': 'Elkholy', 'B15-W2': 'Selvam',
  'B16-W1': 'Elkholy', 'B16-W2': 'Yousafzai',
  'B17-W1': 'Alkhawlani', 'B17-W2': 'Naeem',
  'B18-W1': 'Ezaldin', 'B18-W2': 'Ali',
  'B19-W1': 'Selvam', 'B19-W2': 'Elkholy',
  'B20-W1': 'Varga', 'B20-W2': 'Elsayed',
  'B21-W1': 'Alkhawlani', 'B21-W2': 'Nor',
  'B22-W1': 'Sharma', 'B22-W2': 'Selvam',
  'B23-W1': 'Elsayed', 'B23-W2': 'Varga',
  'B24-W1': 'Sharma', 'B24-W2': 'Naeem',
  'B25-W1': 'Elsayed', 'B25-W2': 'Alkhawlani',
  'B26-W1': 'Ali', 'B26-W2': 'Elkholy'
};

export const initialSwapRequests = [
];

export const allRotationTypes = [
  '', 'AI', 'AI 2', 'AI 3', 'Admin', 'CTS', 'Cath', 'Cath 2', 'Cath 3',
  'E', 'EP', 'Echo', 'Echo 2', 'Floor A', 'Floor B', 'ICU',
  'Nights', 'Nuclear', 'Nuclear 2', 'Research', 'Research 2',
  'SPC', 'Structural', 'Vascular'
];

export const initialClinicSchedule = {
  'B1-W1': 'Yousafzai',    'B1-W2': 'Straley',
  'B2-W1': 'Straley',      'B2-W2': 'Yousafzai',
  'B3-W1': 'Mahmoud',      'B3-W2': 'Elsayed',
  'B4-W1': 'Mahmoud',      'B4-W2': 'Alkhawlani',
  'B5-W1': 'Ali',          'B5-W2': 'Naeem',
  'B6-W1': 'Nor',          'B6-W2': 'Selvam',
  'B7-W1': 'Varga',        'B7-W2': 'Elkholy',
  'B8-W1': 'Yousafzai',    'B8-W2': 'Ezaldin',
  'B9-W1': 'Elkholy',      'B9-W2': 'Ali',
  'B10-W1': 'Straley',     'B10-W2': 'Sharma',
  'B11-W1': 'Selvam',      'B11-W2': 'Varga',
  'B12-W1': 'Mahmoud',     'B12-W2': 'Nor',
  'B13-W1': 'Ezaldin',     'B13-W2': 'Varga',
  'B14-W1': 'Naeem',       'B14-W2': 'Yousafzai',
  'B15-W1': 'Alkhawlani',  'B15-W2': 'Elkholy',
  'B16-W1': 'Naeem',       'B16-W2': 'Selvam',
  'B17-W1': 'Sharma',      'B17-W2': 'Straley',
  'B18-W1': 'Ezaldin',     'B18-W2': 'Sharma',
  'B19-W1': 'Alkhawlani',  'B19-W2': 'Mahmoud',
  'B20-W1': 'Ali',         'B20-W2': 'Nor',
  'B21-W1': 'Elsayed',     'B21-W2': 'Elsayed',
  'B22-W1': 'Nor',         'B22-W2': 'Ali',
  'B23-W1': 'Elsayed',     'B23-W2': 'Selvam',
  'B24-W1': 'Ezaldin',     'B24-W2': 'Varga',
  'B25-W1': 'Sharma',      'B25-W2': 'Elkholy',
  'B26-W1': 'Naeem',       'B26-W2': 'Alkhawlani'
};
