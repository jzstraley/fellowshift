import { useState } from "react";

export default function CookieConsent() {
  const [visible, setVisible] = useState(
    () => localStorage.getItem("cookie_consent") === null
  );

  if (!visible) return null;

  const handleAccept = () => {
    localStorage.setItem("cookie_consent", "accepted");
    // Load gtag and grant consent
    window.gtag("consent", "update", { analytics_storage: "granted" });
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=G-BXJRY8B4W5";
    document.head.appendChild(s);
    window.gtag("js", new Date());
    window.gtag("config", "G-BXJRY8B4W5");
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem("cookie_consent", "declined");
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 text-white px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
      <p className="text-sm text-center sm:text-left">
        We use cookies to analyze site usage and improve your experience.
      </p>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={handleDecline}
          className="px-4 py-2.5 text-sm rounded border border-gray-500 hover:bg-gray-700 transition-colors"
        >
          Decline
        </button>
        <button
          onClick={handleAccept}
          className="px-4 py-2.5 text-sm rounded bg-blue-600 hover:bg-blue-500 transition-colors"
        >
          Accept
        </button>
      </div>
    </div>
  );
}