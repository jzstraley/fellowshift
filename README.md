# FellowShift Update - New Features

## What's New

### 1. 🌙 Dark Mode
- Toggle button in the header (sun/moon icon)
- Persists across sessions
- Applies to all views

### 2. 📅 Lecture Calendar
- Full calendar view with month navigation
- List view for upcoming lectures
- Management view for quick stats
- Click any lecture to see details and manage RSVPs

### 3. 👥 Speaker & Topic Database
- Add, edit, delete speakers (attendings, fellows, external)
- Manage lecture topics with default durations
- Categorize by lecture series (Core Curriculum, Journal Club, Board Review, etc.)

### 4. ✅ RSVP Tracking
- Track attendance per fellow per lecture
- Attending / Not Attending / Maybe status
- Visual summary in lecture list

### 5. 📧 Gmail Integration
- Connect your Gmail account via OAuth
- Send automated lecture reminders
- Configurable reminder settings (days before, recipients)
- **Note:** Requires Google Cloud setup (see instructions in Gmail tab)

### 6. 🔄 Recurring Lecture Support
- One-time, weekly, bi-weekly, monthly options
- First/last of month patterns

---

## Installation

Copy these files to your existing FellowShift project:

```
src/
├── App.jsx                          (replace)
├── context/
│   └── ThemeContext.jsx             (new)
├── data/
│   └── lectureData.js               (new)
└── components/
    ├── HeaderBar.jsx                (replace)
    ├── LectureCalendarView.jsx      (new)
    ├── SpeakerTopicManager.jsx      (new)
    └── GmailIntegration.jsx         (new)
```

---

## Gmail Setup (Optional)

To enable Gmail reminders:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable the Gmail API
4. Create OAuth 2.0 credentials (Web application)
5. Add your domain to authorized JavaScript origins
6. Update `GMAIL_CONFIG` in `GmailIntegration.jsx`:

```javascript
const GMAIL_CONFIG = {
  clientId: "YOUR_CLIENT_ID.apps.googleusercontent.com",
  apiKey: "YOUR_API_KEY",
  // ...
};
```

---

## New Navigation Tabs

The header now includes:
- Schedule | Stats | Call/Float | Calendar | Clinic | Vacations | **Lectures** | **Speakers** | **Gmail**

---

## Data Persistence

All lecture data (lectures, speakers, topics, fellow emails) is saved to localStorage under key `fellowship_lectures_v1`.

Use "Reset to Defaults" to clear all data including lectures.

---

© 2026 Austin Straley, DO