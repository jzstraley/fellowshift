// src/components/GmailIntegration.jsx
import React, { useState, useEffect } from "react";
import {
  Mail,
  Check,
  X,
  AlertCircle,
  Settings,
  Send,
  RefreshCw,
  Link,
  Unlink,
  Clock,
  Users,
  Calendar,
} from "lucide-react";

// Gmail OAuth Configuration
// Note: You'll need to set up a Google Cloud project and enable Gmail API
// Then replace these with your actual credentials
const GMAIL_CONFIG = {
  clientId: "YOUR_CLIENT_ID.apps.googleusercontent.com",
  apiKey: "YOUR_API_KEY",
  scopes: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly",
  discoveryDoc: "https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest",
};

export default function GmailIntegration({
  lectures,
  speakers,
  fellows,
  fellowEmails, // { fellowName: email }
  darkMode,
  onReminderSent,
}) {
  const [isConnected, setIsConnected] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [reminderSettings, setReminderSettings] = useState({
    daysBefore: 1,
    hoursBefore: 2,
    includeRsvpLink: true,
    sendToSpeaker: true,
    sendToFellows: true,
  });

  // Check if gapi is loaded
  const [gapiLoaded, setGapiLoaded] = useState(false);

  useEffect(() => {
    // Load Google API script
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.onload = () => {
      window.gapi.load("client:auth2", initializeGapi);
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const initializeGapi = async () => {
    try {
      await window.gapi.client.init({
        apiKey: GMAIL_CONFIG.apiKey,
        clientId: GMAIL_CONFIG.clientId,
        discoveryDocs: [GMAIL_CONFIG.discoveryDoc],
        scope: GMAIL_CONFIG.scopes,
      });

      setGapiLoaded(true);

      // Check if already signed in
      const authInstance = window.gapi.auth2.getAuthInstance();
      if (authInstance.isSignedIn.get()) {
        const user = authInstance.currentUser.get();
        const profile = user.getBasicProfile();
        setUserEmail(profile.getEmail());
        setIsConnected(true);
      }

      // Listen for sign-in state changes
      authInstance.isSignedIn.listen((signedIn) => {
        if (signedIn) {
          const user = authInstance.currentUser.get();
          const profile = user.getBasicProfile();
          setUserEmail(profile.getEmail());
          setIsConnected(true);
        } else {
          setUserEmail(null);
          setIsConnected(false);
        }
      });
    } catch (err) {
      console.error("Error initializing Google API:", err);
      setError("Failed to initialize Google API. Check console for details.");
    }
  };

  const handleConnect = async () => {
    if (!gapiLoaded) {
      setError("Google API not loaded yet. Please wait...");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const authInstance = window.gapi.auth2.getAuthInstance();
      await authInstance.signIn();
    } catch (err) {
      console.error("Sign in error:", err);
      setError("Failed to connect to Gmail. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!gapiLoaded) return;

    try {
      const authInstance = window.gapi.auth2.getAuthInstance();
      await authInstance.signOut();
      setIsConnected(false);
      setUserEmail(null);
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  const createEmailContent = (lecture, recipients) => {
    const speakerName = lecture.speakerId
      ? speakers.find((s) => s.id === lecture.speakerId)?.name
      : lecture.presenterFellow;

    const date = new Date(lecture.date).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const time = formatTime(lecture.time);

    const subject = `Reminder: ${lecture.title} - ${date}`;

    const body = `
Dear Fellow,

This is a reminder about the upcoming lecture:

📚 ${lecture.title}
📅 ${date}
🕐 ${time} (${lecture.duration} minutes)
📍 ${lecture.location}
👤 Presenter: ${speakerName || "TBD"}
📋 Series: ${lecture.series}

${lecture.notes ? `Notes: ${lecture.notes}` : ""}

${
  reminderSettings.includeRsvpLink
    ? "Please update your RSVP in FellowShift if you haven't already."
    : ""
}

Best regards,
FellowShift Automated Reminder
    `.trim();

    return { subject, body, recipients };
  };

  const formatTime = (time) => {
    const [h, m] = time.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  const sendEmail = async (to, subject, body) => {
    if (!isConnected || !gapiLoaded) {
      throw new Error("Not connected to Gmail");
    }

    // Create the email in RFC 2822 format
    const email = [
      `To: ${to}`,
      `Subject: ${subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      body,
    ].join("\r\n");

    // Base64url encode the email
    const encodedEmail = btoa(unescape(encodeURIComponent(email)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    try {
      await window.gapi.client.gmail.users.messages.send({
        userId: "me",
        resource: {
          raw: encodedEmail,
        },
      });
      return true;
    } catch (err) {
      console.error("Failed to send email:", err);
      throw err;
    }
  };

  const sendLectureReminder = async (lecture) => {
    if (!isConnected) {
      setError("Please connect to Gmail first");
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const recipients = [];

      // Add speaker email
      if (reminderSettings.sendToSpeaker && lecture.speakerId) {
        const speaker = speakers.find((s) => s.id === lecture.speakerId);
        if (speaker?.email) {
          recipients.push(speaker.email);
        }
      }

      // Add fellow emails
      if (reminderSettings.sendToFellows && fellowEmails) {
        fellows.forEach((f) => {
          if (fellowEmails[f]) {
            recipients.push(fellowEmails[f]);
          }
        });
      }

      if (recipients.length === 0) {
        setError("No valid recipients found");
        return false;
      }

      const { subject, body } = createEmailContent(lecture, recipients);

      // Send to each recipient
      for (const recipient of recipients) {
        await sendEmail(recipient, subject, body);
      }

      onReminderSent?.(lecture.id);
      return true;
    } catch (err) {
      setError(`Failed to send reminder: ${err.message}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Get upcoming lectures that need reminders
  const getUpcomingLectures = () => {
    const now = new Date();
    const reminderCutoff = new Date(
      now.getTime() + reminderSettings.daysBefore * 24 * 60 * 60 * 1000
    );

    return lectures.filter((lec) => {
      const lectureDate = new Date(lec.date);
      return lectureDate > now && lectureDate <= reminderCutoff && !lec.reminderSent;
    });
  };

  const upcomingLectures = getUpcomingLectures();

  const baseClasses = darkMode
    ? "bg-gray-900 text-gray-100"
    : "bg-white text-gray-800";

  const cardClasses = darkMode
    ? "bg-gray-800 border-gray-700"
    : "bg-white border-gray-300";

  const inputClasses = darkMode
    ? "bg-gray-700 border-gray-600 text-gray-100"
    : "bg-white border-gray-300 text-gray-800";

  return (
    <div className={`space-y-4 ${baseClasses}`}>
      {/* Connection Status Card */}
      <div className={`rounded border-2 p-4 ${cardClasses}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Gmail Integration
          </h3>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? "bg-green-500" : "bg-gray-400"
              }`}
            />
            <div>
              <div className="text-sm font-medium">
                {isConnected ? "Connected" : "Not Connected"}
              </div>
              {userEmail && (
                <div className="text-xs text-gray-500">{userEmail}</div>
              )}
            </div>
          </div>

          {isConnected ? (
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-semibold rounded"
            >
              <Unlink className="w-3 h-3" />
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isLoading || !gapiLoaded}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded disabled:opacity-50"
            >
              {isLoading ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Link className="w-3 h-3" />
              )}
              Connect Gmail
            </button>
          )}
        </div>

        {!gapiLoaded && (
          <div className="mt-3 text-xs text-yellow-600 flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Loading Google API...
          </div>
        )}

        {error && (
          <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
            <h4 className="text-sm font-semibold">Reminder Settings</h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Days before lecture
                </label>
                <input
                  type="number"
                  min="1"
                  max="7"
                  value={reminderSettings.daysBefore}
                  onChange={(e) =>
                    setReminderSettings({
                      ...reminderSettings,
                      daysBefore: parseInt(e.target.value) || 1,
                    })
                  }
                  className={`w-full px-2 py-1 text-sm border rounded ${inputClasses}`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  Hours before (same day)
                </label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={reminderSettings.hoursBefore}
                  onChange={(e) =>
                    setReminderSettings({
                      ...reminderSettings,
                      hoursBefore: parseInt(e.target.value) || 2,
                    })
                  }
                  className={`w-full px-2 py-1 text-sm border rounded ${inputClasses}`}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reminderSettings.sendToSpeaker}
                  onChange={(e) =>
                    setReminderSettings({
                      ...reminderSettings,
                      sendToSpeaker: e.target.checked,
                    })
                  }
                  className="rounded"
                />
                Send to speaker
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reminderSettings.sendToFellows}
                  onChange={(e) =>
                    setReminderSettings({
                      ...reminderSettings,
                      sendToFellows: e.target.checked,
                    })
                  }
                  className="rounded"
                />
                Send to all fellows
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reminderSettings.includeRsvpLink}
                  onChange={(e) =>
                    setReminderSettings({
                      ...reminderSettings,
                      includeRsvpLink: e.target.checked,
                    })
                  }
                  className="rounded"
                />
                Include RSVP reminder
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Upcoming Lectures Needing Reminders */}
      {isConnected && upcomingLectures.length > 0 && (
        <div className={`rounded border-2 p-4 ${cardClasses}`}>
          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Upcoming Lectures (Need Reminders)
          </h4>

          <div className="space-y-2">
            {upcomingLectures.map((lec) => (
              <div
                key={lec.id}
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded"
              >
                <div>
                  <div className="text-sm font-medium">{lec.title}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    {new Date(lec.date).toLocaleDateString()}
                    <Clock className="w-3 h-3 ml-2" />
                    {formatTime(lec.time)}
                  </div>
                </div>
                <button
                  onClick={() => sendLectureReminder(lec)}
                  disabled={isLoading}
                  className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded disabled:opacity-50"
                >
                  <Send className="w-3 h-3" />
                  Send
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Setup Instructions */}
      {!isConnected && (
        <div className={`rounded border-2 p-4 ${cardClasses}`}>
          <h4 className="font-semibold text-sm mb-2">Setup Instructions</h4>
          <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
            <li>
              Create a project in{" "}
              <a
                href="https://console.cloud.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Google Cloud Console
              </a>
            </li>
            <li>Enable the Gmail API for your project</li>
            <li>Create OAuth 2.0 credentials (Web application type)</li>
            <li>Add your domain to authorized JavaScript origins</li>
            <li>
              Update GMAIL_CONFIG in GmailIntegration.jsx with your credentials
            </li>
            <li>Click "Connect Gmail" and authorize the application</li>
          </ol>
        </div>
      )}
    </div>
  );
}