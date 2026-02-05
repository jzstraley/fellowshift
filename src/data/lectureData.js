// src/data/lectureData.js

// Lecture series types
export const LECTURE_SERIES = {
  CORE_CURRICULUM: "Core Curriculum",
  JOURNAL_CLUB: "Journal Club",
  CASE_CONFERENCE: "Case Conference",
  BOARD_REVIEW: "Board Review",
  RESEARCH: "Research Seminar",
  GUEST_SPEAKER: "Guest Speaker",
  CATH_CONFERENCE: "Cath Conference",
  ECHO_CONFERENCE: "Echo Conference",
  EP_CONFERENCE: "EP Conference",
  M_AND_M: "M&M Conference",
};

// Recurring patterns
export const RECURRENCE = {
  NONE: "none",
  WEEKLY: "weekly",
  BIWEEKLY: "biweekly",
  MONTHLY: "monthly",
  FIRST_OF_MONTH: "first_of_month",
  LAST_OF_MONTH: "last_of_month",
};

// Default speakers (attendings, external, etc.)
export const initialSpeakers = [
  { id: "sp1", name: "Dr. Smith", title: "Interventional Cardiology", email: "smith@hospital.edu", type: "attending" },
  { id: "sp2", name: "Dr. Johnson", title: "Heart Failure", email: "johnson@hospital.edu", type: "attending" },
  { id: "sp3", name: "Dr. Williams", title: "Electrophysiology", email: "williams@hospital.edu", type: "attending" },
  { id: "sp4", name: "Dr. Brown", title: "Imaging", email: "brown@hospital.edu", type: "attending" },
  { id: "sp5", name: "Dr. Davis", title: "Structural Heart", email: "davis@hospital.edu", type: "attending" },
];

// Topics database
export const initialTopics = [
  { id: "t1", name: "STEMI Management", series: LECTURE_SERIES.CORE_CURRICULUM, duration: 60 },
  { id: "t2", name: "Heart Failure with Reduced EF", series: LECTURE_SERIES.CORE_CURRICULUM, duration: 60 },
  { id: "t3", name: "Atrial Fibrillation Management", series: LECTURE_SERIES.CORE_CURRICULUM, duration: 60 },
  { id: "t4", name: "Aortic Stenosis Evaluation", series: LECTURE_SERIES.ECHO_CONFERENCE, duration: 45 },
  { id: "t5", name: "Complex PCI Cases", series: LECTURE_SERIES.CATH_CONFERENCE, duration: 60 },
  { id: "t6", name: "VT Ablation Principles", series: LECTURE_SERIES.EP_CONFERENCE, duration: 45 },
  { id: "t7", name: "Cardiogenic Shock", series: LECTURE_SERIES.CORE_CURRICULUM, duration: 60 },
  { id: "t8", name: "Pulmonary Hypertension", series: LECTURE_SERIES.CORE_CURRICULUM, duration: 60 },
  { id: "t9", name: "TAVR Patient Selection", series: LECTURE_SERIES.GUEST_SPEAKER, duration: 90 },
  { id: "t10", name: "Board Review: Pharmacology", series: LECTURE_SERIES.BOARD_REVIEW, duration: 90 },
];

// Sample lectures
export const initialLectures = [
  {
    id: "lec1",
    topicId: "t1",
    title: "STEMI Management Update 2026",
    speakerId: "sp1",
    presenterFellow: null,
    date: "2026-07-08",
    time: "12:00",
    duration: 60,
    location: "Conference Room A",
    series: LECTURE_SERIES.CORE_CURRICULUM,
    recurrence: RECURRENCE.NONE,
    rsvps: {},
    notes: "Lunch provided",
    reminderSent: false,
  },
  {
    id: "lec2",
    topicId: "t3",
    title: "AFib: Latest Guidelines",
    speakerId: "sp3",
    presenterFellow: "Elkholy",
    date: "2026-07-15",
    time: "07:00",
    duration: 60,
    location: "Conference Room B",
    series: LECTURE_SERIES.CORE_CURRICULUM,
    recurrence: RECURRENCE.WEEKLY,
    rsvps: {},
    notes: "",
    reminderSent: false,
  },
  {
    id: "lec3",
    topicId: "t5",
    title: "Complex PCI Case Discussion",
    speakerId: "sp1",
    presenterFellow: "Alkhawlani",
    date: "2026-07-10",
    time: "17:00",
    duration: 60,
    location: "Cath Lab Conference Room",
    series: LECTURE_SERIES.CATH_CONFERENCE,
    recurrence: RECURRENCE.WEEKLY,
    rsvps: {},
    notes: "Bring interesting cases",
    reminderSent: false,
  },
  {
    id: "lec4",
    topicId: "t10",
    title: "Board Review: Cardiovascular Pharmacology",
    speakerId: null,
    presenterFellow: "Mahmoud",
    date: "2026-07-22",
    time: "18:00",
    duration: 90,
    location: "Virtual - Zoom",
    series: LECTURE_SERIES.BOARD_REVIEW,
    recurrence: RECURRENCE.BIWEEKLY,
    rsvps: {},
    notes: "PGY-6 led session",
    reminderSent: false,
  },
];

// RSVP status options
export const RSVP_STATUS = {
  PENDING: "pending",
  ATTENDING: "attending",
  NOT_ATTENDING: "not_attending",
  MAYBE: "maybe",
};

// Helper to generate recurring dates
export const generateRecurringDates = (startDate, recurrence, count = 12) => {
  const dates = [];
  let current = new Date(startDate);
  
  for (let i = 0; i < count; i++) {
    dates.push(current.toISOString().split("T")[0]);
    
    switch (recurrence) {
      case RECURRENCE.WEEKLY:
        current.setDate(current.getDate() + 7);
        break;
      case RECURRENCE.BIWEEKLY:
        current.setDate(current.getDate() + 14);
        break;
      case RECURRENCE.MONTHLY:
        current.setMonth(current.getMonth() + 1);
        break;
      case RECURRENCE.FIRST_OF_MONTH:
        current.setMonth(current.getMonth() + 1);
        current.setDate(1);
        // Find first occurrence of the same weekday
        const targetDay = new Date(startDate).getDay();
        while (current.getDay() !== targetDay) {
          current.setDate(current.getDate() + 1);
        }
        break;
      case RECURRENCE.LAST_OF_MONTH:
        current.setMonth(current.getMonth() + 2);
        current.setDate(0); // Last day of previous month
        const targetDayLast = new Date(startDate).getDay();
        while (current.getDay() !== targetDayLast) {
          current.setDate(current.getDate() - 1);
        }
        break;
      default:
        return dates;
    }
  }
  
  return dates;
};