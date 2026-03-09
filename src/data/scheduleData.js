// src/data/scheduleData.js

// Bump this number to re-seed the schedule from initialSchedule on next app load.
// Once seeded, in-app edits persist normally in Supabase. Bump again to re-seed.
// 03/08/2026
export const scheduleVersion = 3;

export const pgyLevels = {
  'Elkholy': 4, 'Naeem': 4, 'Nor': 4, 'Selvam': 4, 'Varga': 4,
  'Alkhawlani': 5, 'Ali': 5, 'Elsayed': 5, 'Ezaldin': 5, 'Sharma': 5,
  'Mahmoud': 6, 'Straley': 6, 'Yousafzai': 6
};

export const initialClinicDays = {
  // PGY-4
  'Elkholy': 1,    // Monday
  'Naeem': 3,      // Wednesday
  'Nor': 3,        // Wednesday
  'Selvam': 2,     // Tuesday
  'Varga': 4,      // Thursday
  // PGY-5
  'Ali': 3, // Wednesday 
  'Alkhawlani': 3,        // Wednesday 
  'Elsayed': 1,    // Monday 
  'Ezaldin': 2,    // Tuesday
  'Sharma': 4,     // Thursday 
  // PGY-6
  'Mahmoud': 3,    // Wednesday 
  'Straley': 2,    // Tuesday 
  'Yousafzai': 1,  // Monday 
};

export const initialSchedule = {
'Elkholy': ['EP', 'EP', 'Cath', 'Cath', 'Nuclear', 'Nuclear', 'Floor A', 'Floor A', 'Echo', 'Echo', 'ICU', 'SPC', 'Floor A', 'Floor A', 'Nuclear', 'ICU', 'AI', 'AI', 'Echo', 'Nights', 'Nuclear', 'Floor A', 'Floor B', 'Echo', 'Nights', 'E'],
'Naeem': ['Cath', 'Cath', 'Floor A', 'Floor A', 'EP', 'EP', 'Echo', 'Echo', 'ICU', 'Nuclear', 'Nuclear', 'Nights', 'AI', 'AI', 'SPC', 'Nuclear', 'Floor A', 'Floor A', 'Nuclear', 'ICU', 'Echo', 'Nights', 'AI', 'Floor A', 'Floor B', 'Echo'],
'Nor': ['Echo', 'Echo', 'EP', 'EP', 'Floor A', 'Floor A', 'Nuclear', 'Nuclear', 'Cath', 'Cath', 'Echo', 'Echo', 'ICU', 'Cath', 'Floor A', 'Floor A', 'Nuclear', 'ICU', 'AI', 'AI', 'Nights', 'Nuclear', 'Floor A', 'Floor B', 'SPC', 'Nights'],
'Selvam': ['Floor A', 'Floor A', 'Nuclear', 'Nuclear', 'Echo', 'Echo', 'Cath', 'Cath', 'EP', 'EP', 'Floor A', 'Floor A', 'Nuclear', 'ICU', 'AI', 'AI', 'SPC', 'Research', 'Nights', 'Nuclear', 'Floor A', 'Floor B', 'Echo', 'Nights', 'Echo', 'ICU'],
'Varga': ['Nuclear', 'Nuclear', 'Echo', 'Echo', 'Cath', 'Cath', 'EP', 'EP', 'Floor A', 'Floor A', 'Cath', 'ICU', 'Echo', 'Echo', 'Nights', 'SPC', 'ICU', 'Nuclear', 'Floor A', 'Floor B', 'AI', 'AI', 'Nights', 'Nuclear', 'Floor A', 'Floor A'],
'Alkhawlani': ['Nights', 'Floor B', 'Nuclear 2', 'Nuclear 2', 'ICU', 'Cath 2', 'Floor B', 'Cath 2', 'AI', 'ICU', 'EP', 'Echo 2', 'Echo 2', 'Floor B', 'AI 2', 'Floor B', 'EP', 'Nights', 'Echo 2', 'Echo 2', 'ICU', 'AI 2', 'Cath 2', 'Cath 2', 'Nuclear 2', 'Nuclear 2'],
'Ali': ['Floor B', 'Nights', 'Nuclear 3', 'ICU', 'AI 2', 'Floor B', 'Echo 2', 'Echo 2', 'Floor B', 'AI 2', 'Cath 2', 'Cath 2', 'Nuclear 2', 'Nuclear 2', 'Floor B', 'AI 2', 'Nights', 'Nuclear 2', 'ICU', 'EP', 'EP', 'ICU', 'Echo 2', 'Echo 2', 'Cath 2', 'Cath 2'],
'Elsayed': ['Cath 2', 'ICU', 'Cath 2', 'Nights', 'Echo 2', 'Echo 2', 'Nuclear 2', 'Floor B', 'Echo 2', 'Echo 2', 'Nights', 'Nuclear 2', 'EP', 'EP', 'ICU', 'Cath 2', 'Cath 2', 'Floor B', 'AI 2', 'Floor A', 'Nuclear 2', 'Nuclear 2', 'ICU', 'AI', 'AI 2', 'Floor B'],
'Ezaldin': ['AI', 'Cath 2', 'ICU', 'Echo 2', 'Nights', 'AI 2', 'ICU', 'AI 2', 'Nights', 'Cath 2', 'Floor B', 'EP', 'Floor B', 'Cath 2', 'Nuclear 2', 'Nuclear 2', 'Floor B', 'Echo 2', 'Nuclear 2', 'Nuclear 2', 'Floor B', 'Cath 2', 'EP', 'ICU', 'Echo 2', 'Echo 2'],
'Sharma': ['ICU', 'Echo 2', 'Echo 2', 'Floor B', 'AI', 'ICU', 'AI 2', 'Nights', 'Cath 2', 'Floor B', 'Nuclear 2', 'Floor B', 'Cath 2', 'Nights', 'EP', 'EP', 'Nuclear 2', 'Cath 2', 'Floor B', 'Cath 2', 'Echo 2', 'Echo 2', 'Nuclear 2', 'Nuclear 2', 'ICU', 'AI 2'],
'Mahmoud': ['Nuclear 2', 'Nuclear 2', 'AI 2', 'AI 2', 'Nuclear 2', 'Vascular', 'CTS', 'ICU', 'Structural', 'Nights', 'AI 2', 'AI 2', 'Nights', 'SPC', 'Echo 2', 'Echo 2', 'Cath 3', 'Cath 3', 'AI 3', 'AI 3', 'Echo 3', 'Echo 3', 'E', 'E', 'Research', 'Research'],
'Straley': ['Echo 2', 'AI 2', 'Nights', 'Cath 2', 'Floor B', 'Nuclear 2', 'Nights', 'Nuclear 2', 'AI 2', 'CTS', 'Vascular', 'Structural', 'Echo 3', 'Echo 3', 'Cath 3', 'Cath 3', 'Echo', 'Echo', 'Cath 3', 'Echo 3', 'Cath 2', 'Admin', 'AI 2', 'AI 2', 'AI 2', 'AI 3'],
'Yousafzai': ['AI 2', 'Vascular', 'Floor B', 'Echo 3', 'Echo 3', 'Nights', 'Cath 2', 'AI', 'Nuclear 2', 'Nuclear 2', 'Echo 3', 'Echo 3', 'AI 2', 'AI 2', 'Cath 2', 'Nights', 'Echo 3', 'Echo 3', 'CTS', 'Structural', 'SPC', 'Admin', 'E', 'E', 'Research', 'Research']
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
  { fellow: 'Straley', startBlock: 1, endBlock: 1, weekPart: 2, reason: 'Vacation', status: 'pending' },
  { fellow: 'Yousafzai', startBlock: 2, endBlock: 2, weekPart: 2, reason: 'Vacation', status: 'pending' },
  { fellow: 'Alkhawlani', startBlock: 3, endBlock: 3, reason: 'Vacation', status: 'pending' },
  { fellow: 'Varga', startBlock: 5, endBlock: 5, weekPart: 1, reason: 'Vacation', status: 'pending' },
  { fellow: 'Selvam', startBlock: 9, endBlock: 9, weekPart: 2, reason: 'Vacation', status: 'pending' },
  { fellow: 'Sharma', startBlock: 9, endBlock: 9, weekPart: 2, reason: 'Vacation', status: 'pending' },
  { fellow: 'Naeem', startBlock: 11, endBlock: 11, weekPart: 1, reason: 'Vacation', status: 'pending' },
  { fellow: 'Varga', startBlock: 13, endBlock: 13, weekPart: 2, reason: 'Vacation', status: 'pending' },
  { fellow: 'Naeem', startBlock: 14, endBlock: 14, weekPart: 2, reason: 'Vacation', status: 'pending' },
  { fellow: 'Nor', startBlock: 14, endBlock: 14, weekPart: 1, reason: 'Vacation', status: 'pending' },
  { fellow: 'Elsayed', startBlock: 14, endBlock: 14, weekPart: 1, reason: 'Vacation', status: 'pending' },
  { fellow: 'Sharma', startBlock: 17, endBlock: 17, weekPart: 2, reason: 'Vacation', status: 'pending' },
  { fellow: 'Selvam', startBlock: 17, endBlock: 17, weekPart: 2, reason: 'Vacation', status: 'pending' },
  { fellow: 'Elkholy', startBlock: 18, endBlock: 18, weekPart: 2, reason: 'Vacation', status: 'pending' },
  { fellow: 'Selvam', startBlock: 18, endBlock: 18, weekPart: 1, reason: 'Vacation', status: 'pending' },
  { fellow: 'Sharma', startBlock: 18, endBlock: 18, weekPart: 1, reason: 'Vacation', status: 'pending' },
  { fellow: 'Elkholy', startBlock: 19, endBlock: 19, weekPart: 1, reason: 'Vacation', status: 'pending' },
  { fellow: 'Nor', startBlock: 19, endBlock: 19, weekPart: 1, reason: 'Vacation', status: 'pending' },
  { fellow: 'Yousafzai', startBlock: 20, endBlock: 20, weekPart: 2, reason: 'Vacation', status: 'pending' },
  { fellow: 'Yousafzai', startBlock: 21, endBlock: 21, weekPart: 1, reason: 'Vacation', status: 'pending' },
  { fellow: 'Naeem', startBlock: 21, endBlock: 21, weekPart: 1, reason: 'Vacation', status: 'pending' },
  { fellow: 'Varga', startBlock: 24, endBlock: 24, weekPart: 2, reason: 'Vacation', status: 'pending' },
  { fellow: 'Alkhawlani', startBlock: 24, endBlock: 24, weekPart: 1, reason: 'Vacation', status: 'pending' },
  { fellow: 'Ali', startBlock: 24, endBlock: 24, weekPart: 2, reason: 'Vacation', status: 'pending' },
  { fellow: 'Elsayed', startBlock: 24, endBlock: 24, reason: 'Vacation', status: 'pending' },
  { fellow: 'Ali', startBlock: 25, endBlock: 25, reason: 'Vacation', status: 'pending' },
  { fellow: 'Straley', startBlock: 26, endBlock: 26, reason: 'Vacation', status: 'pending' },
];

// Initial call and night-float base provided by user
export const initialCallSchedule = {
'B1-W1': 'Elsayed', 'B1-W2': 'Sharma',		
'B2-W1': 'Ezaldin', 'B2-W2': 'Elsayed',		
'B3-W1': 'Mahmoud', 'B3-W2': 'Ezaldin',		
'B4-W1': 'Yousafzai', 'B4-W2': 'Straley',		
'B5-W1': 'Alkhawlani', 'B5-W2': 'Mahmoud',		
'B6-W1': 'Alkhawlani', 'B6-W2': 'Sharma',		
'B7-W1': 'Ali', 'B7-W2': 'Ezaldin',		
'B8-W1': 'Ali', 'B8-W2': 'Alkhawlani',		
'B9-W1': 'Naeem', 'B9-W2': 'Elsayed',		
'B10-W1': 'Naeem', 'B10-W2': 'Straley',		
'B11-W1': 'Yousafzai', 'B11-W2': 'Elkholy',		
'B12-W1': 'Alkhawlani', 'B12-W2': 'Varga',		
'B13-W1': 'Nor', 'B13-W2': 'Naeem',		
'B14-W1': 'Selvam', 'B14-W2': 'Elsayed',		
'B15-W1': 'Selvam', 'B15-W2': 'Naeem',		
'B16-W1': 'Elkholy', 'B16-W2': 'Nor',		
'B17-W1': 'Varga', 'B17-W2': 'Elkholy',		
'B18-W1': 'Nor', 'B18-W2': 'Elsayed',		
'B19-W1': 'Ali', 'B19-W2': 'Varga',		
'B20-W1': 'Sharma', 'B20-W2': 'Selvam',		
'B21-W1': 'Varga', 'B21-W2': 'Elkholy',		
'B22-W1': 'Ali', 'B22-W2': 'Nor',		
'B23-W1': 'Elkholy', 'B23-W2': 'Naeem',		
'B24-W1': 'Ezaldin', 'B24-W2': 'Nor',		
'B25-W1': 'Varga', 'B25-W2': 'Selvam',		
'B26-W1': 'Sharma', 'B26-W2': 'Selvam'
};

export const initialNightFloatSchedule = {
'B1-W1': 'Ezaldin', 'B1-W2': 'Alkhawlani',		
'B2-W1': 'Mahmoud', 'B2-W2': 'Ali',		
'B3-W1': 'Sharma', 'B3-W2': 'Straley',		
'B4-W1': 'Alkhawlani', 'B4-W2': 'Elsayed',		
'B5-W1': 'Naeem', 'B5-W2': 'Ezaldin',		
'B6-W1': 'Selvam', 'B6-W2': 'Yousafzai',		
'B7-W1': 'Nor', 'B7-W2': 'Straley',		
'B8-W1': 'Yousafzai', 'B8-W2': 'Sharma',		
'B9-W1': 'Elkholy', 'B9-W2': 'Ezaldin',		
'B10-W1': 'Nor', 'B10-W2': 'Mahmoud',		
'B11-W1': 'Varga', 'B11-W2': 'Elsayed',		
'B12-W1': 'Nor', 'B12-W2': 'Naeem',		
'B13-W1': 'Selvam', 'B13-W2': 'Mahmoud',		
'B14-W1': 'Ali', 'B14-W2': 'Sharma',		
'B15-W1': 'Elkholy', 'B15-W2': 'Varga',		
'B16-W1': 'Selvam', 'B16-W2': 'Yousafzai',		
'B17-W1': 'Straley', 'B17-W2': 'Ali',		
'B18-W1': 'Varga', 'B18-W2': 'Alkhawlani',		
'B19-W1': 'Naeem', 'B19-W2': 'Selvam',		
'B20-W1': 'Alkhawlani', 'B20-W2': 'Elkholy',		
'B21-W1': 'Elsayed', 'B21-W2': 'Nor',		
'B22-W1': 'Ezaldin', 'B22-W2': 'Naeem',		
'B23-W1': 'Ali', 'B23-W2': 'Varga',		
'B24-W1': 'Sharma', 'B24-W2': 'Selvam',		
'B25-W1': 'Elsayed', 'B25-W2': 'Elkholy',		
'B26-W1': 'Naeem', 'B26-W2': 'Nor'
};

export const initialSwapRequests = [
];

export const allRotationTypes = [
  '', 'AI', 'AI 2', 'AI 3', 'Admin', 'CTS', 'Cath', 'Cath 2', 'Cath 3',
  'E', 'EP', 'Echo', 'Echo 2', 'Echo 3', 'Floor A', 'Floor B', 'ICU',
  'Nights', 'Nuclear', 'Nuclear 2', 'Nuclear 3','Research', 'Research 2',
  'SPC', 'Structural', 'Vascular'
];

export const initialClinicSchedule = {
'B1-W1': 'Ezaldin', 'B1-W2': 'Yousafzai',		
'B2-W1': 'Sharma', 'B2-W2': 'Straley',		
'B3-W1': 'Ali', 'B3-W2': 'Mahmoud',		
'B4-W1': 'Alkhawlani', 'B4-W2': 'Alkhawlani',		
'B5-W1': 'Elsayed', 'B5-W2': 'Elkholy',		
'B6-W1': 'Selvam', 'B6-W2': 'Naeem',		
'B7-W1': 'Nor', 'B7-W2': 'Varga',		
'B8-W1': 'Straley', 'B8-W2': 'Ali',		
'B9-W1': 'Yousafzai', 'B9-W2': 'Elsayed',		
'B10-W1': 'Elkholy', 'B10-W2': 'Selvam',		
'B11-W1': 'Nor', 'B11-W2': 'Sharma',		
'B12-W1': 'Ezaldin', 'B12-W2': 'Elsayed',		
'B13-W1': 'Varga', 'B13-W2': 'Selvam',		
'B14-W1': 'Mahmoud', 'B14-W2': 'Straley',		
'B15-W1': 'Naeem', 'B15-W2': 'Mahmoud',		
'B16-W1': 'Ali', 'B16-W2': 'Naeem',		
'B17-W1': 'Sharma', 'B17-W2': 'Yousafzai',		
'B18-W1': 'Varga', 'B18-W2': 'Ezaldin',		
'B19-W1': 'Alkhawlani', 'B19-W2': 'Elkholy',		
'B20-W1': 'Nor', 'B20-W2': 'Ezaldin',		
'B21-W1': 'Elkholy', 'B21-W2': 'Elsayed',		
'B22-W1': 'Straley', 'B22-W2': 'Varga',		
'B23-W1': 'Mahmoud', 'B23-W2': 'Selvam',		
'B24-W1': 'Yousafzai', 'B24-W2': 'Sharma',		
'B25-W1': 'Nor', 'B25-W2': 'Alkhawlani',		
'B26-W1': 'Ezaldin', 'B26-W2': 'Elkholy'
};
